// Writes the `index.ts` a feature folder is missing, from the symbols its outside importers
// actually ask of it. The restructure left folders that consumers already import by folder name
// while the entry point itself was never written, so the import resolves to nothing.
//
// The entry point re-exports only what outsiders name, never everything in the folder. A blanket
// `export *` drags each consumer through every file's transitive imports, which is how a
// lightweight parser test ends up loading the `node:sqlite` Session index.
//
// Usage: bunx tsx scripts/generate-entry-point.mts <folder> [more folders] [--dry]
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const SOURCE_ROOT = 'apps/desktop/src'
const ROOTS = [SOURCE_ROOT, 'apps/desktop/mocks', 'apps/desktop/e2e']

function walk(directory: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(directory)) {
    if (entry === 'node_modules') continue
    const full = path.join(directory, entry)
    if (statSync(full).isDirectory()) found.push(...walk(full))
    else if (/\.(ts|tsx|mts)$/.test(entry)) found.push(full)
  }
  return found
}

const allFiles = ROOTS.flatMap(walk)

function specifierPathFor(from: string, specifier: string): string {
  if (specifier.startsWith('@/')) return path.join(SOURCE_ROOT, specifier.slice(2))
  return path.join(path.dirname(from), specifier)
}

// One brace list, as the name an importer binds it to. `type` can sit on the whole clause or on
// the single name, and `as` renames only what the importer calls it, never what the folder exports.
function bindingsIn(names: string, clauseIsType: boolean): { name: string; typeOnly: boolean }[] {
  const bindings: { name: string; typeOnly: boolean }[] = []
  for (const raw of names.split(',')) {
    const name = raw
      .trim()
      .replace(/^type\s+/, '')
      .split(/\s+as\s+/)[0]
      ?.trim()
    if (name === undefined || name.length === 0) continue
    bindings.push({ name, typeOnly: clauseIsType || /^\s*type\s/.test(raw) })
  }
  return bindings
}

// What one file imports through the folder's own path.
function bindingsFrom(file: string, folder: string): { name: string; typeOnly: boolean }[] {
  const pattern = /import\s+(type\s+)?\{([^}]*)\}\s*from\s*'((?:\.\.?\/|@\/)[^']+)'/g
  const bindings: { name: string; typeOnly: boolean }[] = []
  for (const match of readFileSync(file, 'utf8').matchAll(pattern)) {
    const [, typeOnly, names, specifier] = match
    if (specifier === undefined || names === undefined) continue
    if (path.normalize(specifierPathFor(file, specifier)) !== path.normalize(folder)) continue
    bindings.push(...bindingsIn(names, typeOnly !== undefined))
  }
  return bindings
}

// Every name an importer outside the folder pulls through it, with whether it asked for it as a
// type. A name wanted as a value anywhere is re-exported as a value.
function wantedSymbols(folder: string): Map<string, boolean> {
  const wanted = new Map<string, boolean>()
  for (const file of allFiles) {
    if (file.startsWith(`${folder}/`)) continue
    for (const binding of bindingsFrom(file, folder)) {
      wanted.set(binding.name, binding.typeOnly && (wanted.get(binding.name) ?? true))
    }
  }
  return wanted
}

// Which file inside the folder exports a given name.
function exporterOf(folder: string, name: string): string | undefined {
  for (const entry of readdirSync(folder)) {
    if (!/\.(ts|tsx)$/.test(entry)) continue
    if (/\.(test|vitest|stories)\.(ts|tsx)$/.test(entry)) continue
    // Regenerating over an entry point that already exists must not re-export it from itself.
    if (entry === 'index.ts' || entry === 'index.tsx') continue
    const contents = readFileSync(path.join(folder, entry), 'utf8')
    const declared = new RegExp(
      `export\\s+(?:async\\s+)?(?:const|function|class|type|interface|enum)\\s+${name}\\b`,
    )
    const listed = new RegExp(`export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`)
    if (declared.test(contents) || listed.test(contents)) return entry.replace(/\.(ts|tsx)$/, '')
  }
  return undefined
}

const dryRun = process.argv.includes('--dry')
const folders = process.argv.slice(2).filter((argument) => !argument.startsWith('--'))

for (const folder of folders) {
  const wanted = wantedSymbols(folder)
  if (wanted.size === 0) {
    console.warn(`${folder}: no outside importer names anything from it`)
    continue
  }
  const byFile = new Map<string, { name: string; typeOnly: boolean }[]>()
  const missing: string[] = []
  for (const [name, typeOnly] of wanted) {
    const file = exporterOf(folder, name)
    if (file === undefined) {
      missing.push(name)
      continue
    }
    byFile.set(file, [...(byFile.get(file) ?? []), { name, typeOnly }])
  }
  if (missing.length > 0) console.warn(`${folder}: no file exports ${missing.join(', ')}`)

  const lines = [...byFile.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([file, symbols]) => {
      const names = symbols
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((symbol) => (symbol.typeOnly ? `type ${symbol.name}` : symbol.name))
        .join(', ')
      return `export { ${names} } from './${file}'`
    })
  const contents = `${lines.join('\n')}\n`
  console.log(`--- ${folder}/index.ts (${wanted.size - missing.length} symbols)`)
  console.log(contents)
  if (!dryRun) writeFileSync(path.join(folder, 'index.ts'), contents)
}
