#!/usr/bin/env node

/**
 * The visual contract's zero-reader sweep, by CALL-SITE shape rather than by type name.
 *
 *   node scripts/contract-readers.mjs [--json]
 *
 * A type-name grep cannot see a member reached through an extension method — `ArgoFloatingGlass`,
 * `ArgoLabelStyle` and `ArgoRamp` each had zero reads of their own name and were drawn constantly
 * (#774). So this matches the shape a call site actually spells, and reports two groups rather than
 * one number: what nothing reads at all, and what only the specimen and the assertions read.
 *
 * The judgement afterwards is a human's — `docs/agents/contract-sweep.md` holds the method and the
 * four categories a member is classified into. Reporting only; it never exits non-zero on a finding.
 */

import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CONTRACT = 'apps/macOS/Packages/ArgoUI/Sources/ArgoUI/VisualContract'
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

/// Code only. Prose names roles constantly without reading one, so a comment or a string literal
/// counting as a call site is what makes a sweep too diluted to read to the end.
const code = (line) => line.replace(/"[^"]*"/g, '""').replace(/\/\/.*$/, '')

/// Every member declared in one contract file, each with the type path it hangs off. Brace depth
/// rather than indentation, because a `let` at a type's body depth is a member and the same `let`
/// one depth further in is a local — and the two are indented alike.
function declarations(file) {
  const found = []
  const scope = []
  let depth = 0
  for (const [index, line] of readFileSync(file, 'utf8').split('\n').entries()) {
    const stripped = code(line)
    const type = stripped.match(TYPE)
    const member = stripped.match(VALUE) ?? stripped.match(FUNC) ?? stripped.match(CASE)
    if (!type && member && depth === (scope.at(-1)?.depth ?? -1)) {
      const owner = scope.map((level) => level.name).join('.')
      found.push({ name: member[2], kind: member[1], owner, file, line: index + 1 })
    }
    depth += (stripped.match(/{/g) ?? []).length - (stripped.match(/}/g) ?? []).length
    while (scope.length > 0 && depth < scope.at(-1).depth) scope.pop()
    if (type) scope.push({ depth, name: type[1] })
  }
  return found
}

/// Which population a reader belongs to. Only an `app` reader is a surface drawing the value; the
/// rest are the contract talking to itself, the specimen looking at it, or a test asserting it.
function population(file) {
  const parts = file.split(path.sep)
  if (parts.includes('VisualContract')) return 'contract'
  if (parts.includes('Specimen')) return 'specimen'
  if (parts.some((part) => part.endsWith('Tests'))) return 'tests'
  return 'app'
}

/// The three shapes one member is looked for in. `site` is the one a type-name grep cannot see:
/// `.name` reaches a member on its type or through inference, and a bare `name(` opens a modifier
/// chain, which is how an extension method is reached (`argoInk(theme)`). `inside` is the whole
/// name, for the declaring file, since a type reads its own members unqualified. `catalog` is the
/// family's `all` naming the member beside itself — enumerating it, never reading it.
function shapes(member) {
  const reach = member.kind === 'func' ? String.raw`|\b${member.name}\s*\(` : ''
  return {
    site: new RegExp(String.raw`\.${member.name}\b${reach}`),
    inside: new RegExp(String.raw`\b${member.name}\b`),
    catalog: new RegExp(`"${member.name}"`),
  }
}

/// Where one member is read, in one file, split by which population the file belongs to.
function readersIn(member, file, shape) {
  const own = file.path === member.file
  const found = []
  for (const [index, line] of file.lines.entries()) {
    if (!(own ? shape.inside : shape.site).test(code(line))) continue
    if (own && (index + 1 === member.line || shape.catalog.test(line))) continue
    found.push([own ? 'own' : population(file.short), `${file.short}:${index + 1}`])
  }
  return found
}

function readers(member, corpus) {
  const shape = shapes(member)
  const hits = { app: [], own: [], contract: [], specimen: [], tests: [] }
  for (const file of corpus) {
    for (const [where, at] of readersIn(member, file, shape)) hits[where].push(at)
  }
  return hits
}

/**
 * Sweeps every member declared under `contractDir` for its readers under `searchRoot`.
 *
 * Two families' same-named members share one count, which can only ever KEEP a member — the sweep
 * errs towards keeping one rather than towards deleting a live one. `shared` says of a member
 * whether its name is one of those, so a list entry marked with it is read before it is acted on.
 */
export function sweep({ contractDir, searchRoot }) {
  const members = swiftFiles(contractDir).flatMap(declarations)
  const corpus = swiftFiles(searchRoot).map((file) => ({
    path: file,
    short: path.relative(searchRoot, file),
    lines: readFileSync(file, 'utf8').split('\n'),
  }))
  const swept = members.map((member) => ({ ...member, hits: readers(member, corpus) }))

  const count = (member) => Object.values(member.hits).reduce((sum, at) => sum + at.length, 0)
  // A member another value is built out of — `ArgoTypeScale.callout` under an `ArgoTypography`
  // role, `ArgoColor.red` under `.color` — is read, just not at a surface. Only the two groups
  // below are a judgement: nothing reads it at all, or only the specimen and its assertions do.
  const composed = (member) => member.hits.own.length + member.hits.contract.length > 0
  const unread = swept.filter((member) => count(member) === 0)
  const undrawn = swept.filter(
    (member) => count(member) > 0 && member.hits.app.length === 0 && !composed(member),
  )
  // A name a second family also spells is marked on both lists rather than resolved: the count they
  // share can only ever KEEP a member, so a shared name never puts one on a list it does not belong
  // on. What it can do is hold one off — which is why the marker is read, not skipped.
  const families = new Map()
  for (const member of swept) {
    families.set(member.name, (families.get(member.name) ?? new Set()).add(member.owner))
  }
  const shared = (member) => families.get(member.name).size > 1

  return { total: swept.length, members: swept, unread, undrawn, shared }
}

function main() {
  const result = sweep({
    contractDir: path.join(ROOT, CONTRACT),
    searchRoot: path.join(ROOT, SEARCH),
  })
  if (process.argv.includes('--json')) {
    const { total, unread, undrawn } = result
    console.log(JSON.stringify({ total, unread, undrawn }, null, 2))
    return
  }

  const report = (title, group) => {
    console.log(`\n${title} — ${group.length}\n`)
    for (const member of group) {
      const where = ['app', 'own', 'contract', 'specimen', 'tests']
        .filter((kind) => member.hits[kind].length > 0)
        .map((kind) => `${kind} ${member.hits[kind].length}`)
        .join(', ')
      const namesake = result.shared(member) ? '  [shared name]' : ''
      console.log(`  ${member.owner}.${member.name}${where ? `  (${where})` : ''}${namesake}`)
    }
  }

  console.log(`${result.total} members swept`)
  report('No call site anywhere — nothing but its own catalog names it', result.unread)
  report('Read only by the specimen and its assertions — no surface draws it', result.undrawn)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
