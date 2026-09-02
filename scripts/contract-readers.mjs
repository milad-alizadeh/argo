#!/usr/bin/env node

// The visual contract's zero-reader sweep. Method, populations and judgements:
// `docs/agents/contract-sweep.md`. Reporting only — never exits non-zero on a finding.
//
//   node scripts/contract-readers.mjs [--json]

import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CONTRACT = 'apps/macOS/Packages/ArgoDesign/Sources/ArgoDesign'
const SEARCH = 'apps/macOS'

const ACCESS = /(?:public\s+|private\s+|internal\s+|fileprivate\s+)?/.source
const TYPE = new RegExp(`^\\s*${ACCESS}(?:enum|struct|final class|class|extension)\\s+(\\w+)`)
const VALUE = new RegExp(`^\\s*${ACCESS}(?:static\\s+)?(let|var)\\s+(\\w+)`)
const FUNC = new RegExp(`^\\s*${ACCESS}(?:static\\s+)?(func)\\s+(\\w+)`)
const CASE = /^\s*(case)\s+([a-z]\w*)(?:\s*=|\s*\(|\s*,|\s*$)/

const swiftFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === '.build' ? [] : swiftFiles(file)
    return entry.name.endsWith('.swift') ? [file] : []
  })

// Prose names roles constantly without reading one.
const code = (line) => line.replace(/"[^"]*"/g, '""').replace(/\/\/.*$/, '')

// Every member of one contract file, with the type path it hangs off. Brace depth, not indentation:
// a `let` at a type's body depth is a member and the same `let` one depth in is a local.
function declarations(file) {
  const found = []
  const scope = []
  let depth = 0
  for (const [index, line] of readFileSync(file, 'utf8').split('\n').entries()) {
    const stripped = code(line)
    const type = stripped.match(TYPE)
    const member = stripped.match(VALUE) ?? stripped.match(FUNC) ?? stripped.match(CASE)
    if (!type && member && depth === (scope.at(-1)?.depth ?? 0)) {
      const owner = scope.map((level) => level.name).join('.') || path.basename(file, '.swift')
      found.push({ name: member[2], kind: member[1], owner, file, line: index + 1 })
    }
    depth += (stripped.match(/{/g) ?? []).length - (stripped.match(/}/g) ?? []).length
    while (scope.length > 0 && depth < scope.at(-1).depth) scope.pop()
    if (type) scope.push({ depth, name: type[1] })
  }
  return found
}

// Only an `app` reader is a surface drawing the value. Which files are contract is taken from
// where the contract IS rather than from a folder name: `ArgoDesign` is a module now, and a name
// this counted on would count `ArgoAtoms` beside it as contract too (#1088).
const populationIn = (contract) => (file) => {
  if (file === contract || file.startsWith(contract + path.sep)) return 'contract'
  const parts = file.split(path.sep)
  if (parts.includes('Specimen')) return 'specimen'
  if (parts.some((part) => part.endsWith('Tests'))) return 'tests'
  return 'app'
}

// `site` is the shape a type-name grep cannot see; `inside` is the declaring file, where a type
// reads its own members unqualified; `catalog` is the family's `all`, which enumerates rather
// than reads.
function shapes(member) {
  const reach = member.kind === 'func' ? String.raw`|\b${member.name}\s*\(` : ''
  return {
    site: new RegExp(String.raw`\.${member.name}\b${reach}`),
    inside: new RegExp(String.raw`\b${member.name}\b`),
    catalog: new RegExp(`"${member.name}"`),
  }
}

// `lens` is the shapes this member is spelled in plus the reading of where a file sits, which
// travel together: neither says anything about a hit on its own.
function readersIn(member, file, lens) {
  const own = file.path === member.file
  const found = []
  for (const [index, line] of file.lines.entries()) {
    if (!(own ? lens.inside : lens.site).test(code(line))) continue
    if (own && (index + 1 === member.line || lens.catalog.test(line))) continue
    found.push([own ? 'own' : lens.population(file.short), `${file.short}:${index + 1}`])
  }
  return found
}

function readers(member, corpus, population) {
  const lens = { ...shapes(member), population }
  const hits = { app: [], own: [], contract: [], specimen: [], tests: [] }
  for (const file of corpus) {
    for (const [where, at] of readersIn(member, file, lens)) hits[where].push(at)
  }
  return hits
}

// Whether a second family spells this member's name too. The count they share can only ever KEEP a
// member, so it is a marker to read before acting, not an error.
function namesakes(swept) {
  const families = new Map()
  for (const member of swept) {
    families.set(member.name, (families.get(member.name) ?? new Set()).add(member.owner))
  }
  return (member) => families.get(member.name).size > 1
}

/** Sweeps every member declared under `contractDir` for its readers under `searchRoot`. */
export function sweep({ contractDir, searchRoot }) {
  const declared = swiftFiles(contractDir).flatMap(declarations)
  const corpus = swiftFiles(searchRoot).map((file) => ({
    path: file,
    short: path.relative(searchRoot, file),
    lines: readFileSync(file, 'utf8').split('\n'),
  }))
  const shared = namesakes(declared)
  const population = populationIn(path.relative(searchRoot, contractDir))
  const members = declared.map((member) => ({
    ...member,
    hits: readers(member, corpus, population),
    shared: shared(member),
  }))

  const count = (member) => Object.values(member.hits).reduce((sum, at) => sum + at.length, 0)
  // A value another value is built out of is read, just not at a surface.
  const composed = (member) => member.hits.own.length + member.hits.contract.length > 0
  return {
    members,
    unread: members.filter((member) => count(member) === 0),
    undrawn: members.filter(
      (member) => count(member) > 0 && member.hits.app.length === 0 && !composed(member),
    ),
  }
}

function main() {
  const result = sweep({
    contractDir: path.join(ROOT, CONTRACT),
    searchRoot: path.join(ROOT, SEARCH),
  })
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ unread: result.unread, undrawn: result.undrawn }, null, 2))
    return
  }

  const report = (title, group) => {
    console.log(`\n${title} — ${group.length}\n`)
    for (const member of group) {
      const where = ['app', 'own', 'contract', 'specimen', 'tests']
        .filter((kind) => member.hits[kind].length > 0)
        .map((kind) => `${kind} ${member.hits[kind].length}`)
        .join(', ')
      const namesake = member.shared ? '  [shared name]' : ''
      console.log(`  ${member.owner}.${member.name}${where ? `  (${where})` : ''}${namesake}`)
    }
  }

  console.log(`${result.members.length} members swept`)
  report('No call site anywhere — nothing but its own catalog names it', result.unread)
  report('Read only by the specimen and its assertions — no surface draws it', result.undrawn)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
