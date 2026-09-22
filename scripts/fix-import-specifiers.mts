// Rewrites the import specifiers that the three directional dependency-cruiser rules reject:
// an alias used inside one facet, a relative path used across facets, and a relative path used
// from mocks/ or e2e/ into src. Each is a spelling error about one module specifier, so the fix
// is mechanical and changes no behaviour: the target module is identical either side of it.
// dependency-cruiser's own JSON is the input, because it already records the raw specifier, the
// path it resolved to, and the rule it broke. Nothing here re-derives which edges are wrong.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const SOURCE_ROOT = 'apps/desktop/src'
const ALIAS = '@/'
const RELATIVE_RULES = new Set(['no-aliased-same-facet-import'])
const ALIAS_RULES = new Set([
  'no-relative-cross-facet-import',
  'mocks-and-e2e-reach-src-through-alias',
])

type Dependency = { module: string; resolved: string; rules?: { name: string }[] }
type Module = { source: string; dependencies: Dependency[] }

// tsconfig resolves an extensionless specifier, so a rewritten one drops the extension it would
// otherwise gain. An implementation file that resolved through a folder index is named by folder.
function specifierBody(resolved: string): string {
  const withoutExtension = resolved.replace(/\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/, '')
  return withoutExtension.replace(/\/index$/, '')
}

function aliasSpecifier(resolved: string): string {
  return ALIAS + path.relative(SOURCE_ROOT, specifierBody(resolved))
}

function relativeSpecifier(from: string, resolved: string): string {
  const relative = path.relative(path.dirname(from), specifierBody(resolved))
  return relative.startsWith('.') ? relative : `./${relative}`
}

// An edge can break more than one rule, and only the directional ones are a spelling error, so
// the rule that drove the rewrite is reported rather than every rule the edge happens to break.
function correctedSpecifier(
  from: string,
  dependency: Dependency,
): { specifier: string; rule: string } | undefined {
  for (const { name } of dependency.rules ?? []) {
    if (RELATIVE_RULES.has(name)) {
      return { specifier: relativeSpecifier(from, dependency.resolved), rule: name }
    }
    if (ALIAS_RULES.has(name)) return { specifier: aliasSpecifier(dependency.resolved), rule: name }
  }
  return undefined
}

// The specifier is always a quoted string literal, so matching it with its quotes makes the
// replacement exact: a longer path that merely starts with this one cannot match.
function rewriteSpecifier(
  contents: string,
  from: string,
  to: string,
): { contents: string; hits: number } {
  let hits = 0
  let rewritten = contents
  for (const quote of ["'", '"', '`']) {
    const needle = quote + from + quote
    const replacement = quote + to + quote
    const parts = rewritten.split(needle)
    hits += parts.length - 1
    rewritten = parts.join(replacement)
  }
  return { contents: rewritten, hits }
}

function cruise(): Module[] {
  const stdout = execFileSync(
    'npx',
    [
      'depcruise',
      '--config',
      '.dependency-cruiser.json',
      '--output-type',
      'json',
      `${SOURCE_ROOT}`,
      'apps/desktop/mocks',
      'apps/desktop/e2e',
    ],
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
  )
  return (JSON.parse(stdout) as { modules: Module[] }).modules
}

const dryRun = process.argv.includes('--dry')
const counts = new Map<string, number>()
let changedFiles = 0
let rewrites = 0
let unmatched = 0

for (const module of cruise()) {
  // The graph also carries the core and package modules each file reaches; only a file in this
  // repository has a source to rewrite.
  if (!module.source.startsWith('apps/desktop/')) continue
  let contents = readFileSync(module.source, 'utf8')
  const original = contents
  // One specifier can arrive twice, because a module imported both as a type and as a value is
  // two dependency records over the same text. The first rewrite takes every occurrence, so a
  // second pass would find nothing and report a false miss.
  const handled = new Set<string>()
  for (const dependency of module.dependencies) {
    const corrected = correctedSpecifier(module.source, dependency)
    if (corrected === undefined || corrected.specifier === dependency.module) continue
    if (handled.has(dependency.module)) continue
    handled.add(dependency.module)
    const result = rewriteSpecifier(contents, dependency.module, corrected.specifier)
    if (result.hits === 0) {
      console.warn(`no literal match for ${dependency.module} in ${module.source}`)
      unmatched += 1
      continue
    }
    contents = result.contents
    rewrites += result.hits
    counts.set(corrected.rule, (counts.get(corrected.rule) ?? 0) + result.hits)
  }
  if (contents === original) continue
  changedFiles += 1
  if (!dryRun) writeFileSync(module.source, contents)
}

for (const [rule, count] of [...counts].sort((a, b) => b[1] - a[1])) {
  console.log(`${String(count).padStart(6)}  ${rule}`)
}
console.log(
  `${rewrites} specifiers in ${changedFiles} files${dryRun ? ' (dry run, nothing written)' : ''}`,
)
if (unmatched > 0) console.log(`${unmatched} specifiers found no literal match and were left alone`)
