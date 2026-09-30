// The transcript fixture files themselves, reachable from plain node. Ten came from the
// deprecated `apps/macOS` engine's suite, which recorded the record shapes real Claude
// transcripts carry; they are owned here so this app's tests survive that app's removal and run
// under this app's path filter in CI. `askPending`, `titledHeadless`, `prose`, `subagentTail`,
// `strandedResume`, `plannedWork`, `marks` and `shellRunning` are new, for readings the copied set
// does not reach.
//
// Kept apart from `session-story-host` because the packaged proof runs under node, which cannot
// resolve the extensionless TypeScript imports that file reaches for.
import { createHash } from 'node:crypto'
import { existsSync, readdirSync } from 'node:fs'
import { mkdir, readdir, readFile, utimes, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { claudeProjectFolder } from '../cli/claude/mock-claude-transcripts'

// A run always starts in `apps/desktop`; `import.meta` is unavailable once Playwright loads this as CommonJS.
const FIXTURES = path.join(process.cwd(), 'mocks', 'cli', 'claude', 'fixtures', 'sessions')
const SUBAGENTS = path.join(FIXTURES, '..', 'subagents')

export async function fixtureLines(name, fixtures = FIXTURES) {
  const text = await readFile(path.join(fixtures, `${name}.jsonl`), 'utf8')
  return text.split('\n').filter((line) => line.length > 0)
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

// A Harness names each Session by a UUID, so a fixture named for its reading gets a stable one.
export function fixtureSessionId(name: string) {
  if (UUID.test(name)) return name
  const hex = createHash('sha256').update(name).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

// Where one Session's transcript already sits in a tree this module wrote, whichever working
// directory's folder holds it.
export function fixturePath(transcripts, name) {
  const file = `${fixtureSessionId(name)}.jsonl`
  const folder = readdirSync(transcripts).find((entry) =>
    existsSync(path.join(transcripts, entry, file)),
  )
  if (folder === undefined) throw new Error(`No transcript for ${name} under ${transcripts}.`)
  return path.join(transcripts, folder, file)
}

// Where a new Session run in `cwd` lands, with its folder made.
export async function newFixturePath(transcripts, name, cwd) {
  const folder = claudeProjectFolder(transcripts, cwd)
  await mkdir(folder, { recursive: true })
  return path.join(folder, `${fixtureSessionId(name)}.jsonl`)
}

export async function replaceInFile(file, search, replacement) {
  const before = await readFile(file, 'utf8')
  await writeFile(file, before.split(search).join(replacement))
  // The transcript summariser caches a file by path and mtime; a coarse filesystem clock can
  // leave this write's mtime tied with the read that happened before it, so the resume that
  // follows would see the stale, pre-patch content. Setting the mtime into the near future rules
  // that tie out rather than hoping the clock ticked.
  const future = new Date(Date.now() + 60_000)
  await utimes(file, future, future)
}

// The packaged proof's own Project folder, two levels above either Harness's transcript root
// (`claude-config/projects`, `codex-home/sessions`). The cockpit shows no Roster without a
// selected Project (#2307), so a proof selects this one and places every cwd under it.
export function proofProject(transcripts) {
  return path.join(transcripts, '..', '..', 'project')
}

export function proofCwd(transcripts, place) {
  return path.join(proofProject(transcripts), place)
}

// The fixtures record their cwd under the mock home `/Users/x`, which a selected Project scopes out.
function placeInProofProject(text, transcripts) {
  return text.replace(/("cwd":\s*")\/Users\/x(?=[/"])/g, `$1${proofProject(transcripts)}`)
}

function withSessionId(text, name) {
  return text.replace(
    new RegExp(`("sessionId":\\s*")${name}"`, 'g'),
    `$1${fixtureSessionId(name)}"`,
  )
}

function recordedCwd(text, name) {
  const cwd = /"cwd":\s*"([^"]+)"/.exec(text)?.[1]
  if (cwd === undefined) throw new Error(`The ${name} fixture records no cwd.`)
  return cwd
}

// The Subagent transcripts the Harness keeps in a folder beside the Session's own file.
async function writeSubagents(transcripts, name, folder) {
  const source = path.join(SUBAGENTS, name)
  const entries = await readdir(source).catch(() => [])
  if (entries.length === 0) return
  const destination = path.join(folder, fixtureSessionId(name), 'subagents')
  await mkdir(destination, { recursive: true })
  for (const entry of entries) {
    const text = await readFile(path.join(source, entry), 'utf8')
    await writeFile(path.join(destination, entry), placeInProofProject(text, transcripts))
  }
}

// A Claude transcript root shaped the way the Harness writes one: a folder per working directory
// holding one `<sessionId>.jsonl` per Session. Written in the given order, so the mtime ordering
// is the argument order reversed.
export async function writeFixtureTree(transcripts, names) {
  for (const name of names) {
    const lines = await fixtureLines(name)
    const text = withSessionId(placeInProofProject(`${lines.join('\n')}\n`, transcripts), name)
    const file = await newFixturePath(transcripts, name, recordedCwd(text, name))
    await writeFile(file, text)
    await writeSubagents(transcripts, name, path.dirname(file))
  }
  return transcripts
}
