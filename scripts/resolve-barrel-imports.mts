// Rewrites a named import that lands on a folder entry point so it names the file that actually
// declares the symbol. An entry point re-exports by name, but a named re-export still evaluates
// every module it lists, so one import of a facet index loads the whole facet. That is how a
// transcript parser test ends up loading the `node:sqlite` Session index and dying under `bun test`.
//
// Only the caller's own listed files are touched, because reaching past an entry point is a
// boundary breach everywhere except a harness, which `domain-port-only` does not cover.
//
// Usage: bunx tsx scripts/resolve-barrel-imports.mts <file> [more files] [--dry]
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import {
  aliasFor,
  isEntryPoint,
  moduleFile,
  specifierPathFor,
  withoutExtension,
} from './import-paths.mts'

// A re-export names the symbol as the outside sees it, which is the name after `as`.
function reExportedNames(names: string): (string | undefined)[] {
  return names.split(',').map((raw) =>
    raw
      .trim()
      .replace(/^type\s+/, '')
      .split(/\s+as\s+/)
      .pop()
      ?.trim(),
  )
}

function declares(file: string, name: string): boolean {
  const pattern = new RegExp(
    `export\\s+(?:declare\\s+)?(?:async\\s+)?(?:const|function|class|type|interface|enum)\\s+${name}\\b`,
  )
  return pattern.test(readFileSync(file, 'utf8'))
}

function namedReExportOwner(entry: string, contents: string, name: string): string | undefined {
  for (const match of contents.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}\s*from\s*'([^']+)'/g)) {
    const [, names, specifier] = match
    if (names === undefined || specifier === undefined) continue
    if (!reExportedNames(names).includes(name)) continue
    const target = moduleFile(specifierPathFor(entry, specifier))
    if (target === undefined) return undefined
    return isEntryPoint(target) ? declaringFile(target, name) : target
  }
  return undefined
}

// A star re-export hides which file owns the name, so each one is searched in turn.
function starReExportOwner(entry: string, contents: string, name: string): string | undefined {
  for (const match of contents.matchAll(/export\s+\*\s+from\s*'([^']+)'/g)) {
    const specifier = match[1]
    if (specifier === undefined) continue
    const target = moduleFile(specifierPathFor(entry, specifier))
    if (target === undefined) continue
    const found = isEntryPoint(target) ? declaringFile(target, name) : target
    if (found !== undefined && declares(found, name)) return found
  }
  return undefined
}

// Where a name re-exported by an entry point is declared. Follows a chain of entry points, so a
// facet index that re-exports a feature index that re-exports a file lands on the file.
function declaringFile(entry: string, name: string): string | undefined {
  const contents = readFileSync(entry, 'utf8')
  return namedReExportOwner(entry, contents, name) ?? starReExportOwner(entry, contents, name)
}

// `domain-port-only` still holds: a file inside one domain reaches another domain through its
// entry point and nowhere else, so that one edge keeps the barrel it costs.
function domainOf(file: string): string | undefined {
  return /^apps\/desktop\/src\/domains\/([^/]+)\//.exec(file)?.[1]
}

function crossesDomains(from: string, target: string): boolean {
  const source = domainOf(from)
  const destination = domainOf(target)
  return source !== undefined && destination !== undefined && source !== destination
}

const FACET =
  /^(apps\/desktop\/src\/(?:domains\/[^/]+\/(?:contract|main|preload|renderer)|platform\/(?:main|preload|renderer|shared)|harnesses\/[^/]+|renderer|shared))\//

// `no-aliased-same-facet-import`: the alias is for crossing a facet, and inside one the relative
// path is the spelling. Writing every rewrite as an alias would trade one gate for another.
function specifierFor(from: string, target: string): string {
  const here = FACET.exec(from)?.[1]
  if (here === undefined || here !== FACET.exec(target)?.[1]) return aliasFor(target)
  const relative = path.relative(path.dirname(from), withoutExtension(target))
  return relative.startsWith('.') ? relative : `./${relative}`
}

const dryRun = process.argv.includes('--dry')
const files = process.argv.slice(2).filter((argument) => !argument.startsWith('--'))
let rewritten = 0
const unresolved: string[] = []

for (const file of files) {
  let contents = readFileSync(file, 'utf8')
  const original = contents
  const pattern = /import\s+(type\s+)?\{([^}]*)\}\s*from\s*'((?:\.\.?\/|@\/)[^']+)'\n/g
  for (const match of [...contents.matchAll(pattern)]) {
    const [whole, clauseType, names, specifier] = match
    if (names === undefined || specifier === undefined) continue
    const target = moduleFile(specifierPathFor(file, specifier))
    if (target === undefined || !isEntryPoint(target)) continue
    if (crossesDomains(file, target)) continue
    const byFile = new Map<string, string[]>()
    let missed = false
    for (const raw of names.split(',')) {
      const binding = raw.trim()
      if (binding.length === 0) continue
      const name = binding
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)[0]
        ?.trim()
      if (name === undefined) continue
      const owner = declaringFile(target, name)
      if (owner === undefined) {
        unresolved.push(`${file}: ${name} from ${specifier}`)
        missed = true
        break
      }
      byFile.set(owner, [...(byFile.get(owner) ?? []), binding])
    }
    if (missed) continue
    const lines = [...byFile.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([owner, bindings]) => {
        const clause = clauseType === undefined ? 'import' : 'import type'
        return `${clause} { ${bindings.join(', ')} } from '${specifierFor(file, owner)}'\n`
      })
    contents = contents.replace(whole, lines.join(''))
    rewritten += 1
  }
  if (contents === original) continue
  if (!dryRun) writeFileSync(file, contents)
}

for (const line of unresolved) console.warn(`unresolved: ${line}`)
console.log(`${rewritten} barrel imports resolved${dryRun ? ' (dry run)' : ''}`)
