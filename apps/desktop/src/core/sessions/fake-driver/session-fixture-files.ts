// The transcript fixture files themselves, reachable from plain node. Ten came from the
// deprecated `apps/macOS` engine's suite, which recorded the record shapes real Claude
// transcripts carry; they are owned here so this app's tests survive that app's removal and run
// under this app's path filter in CI. `askPending`, `titledHeadless`, `prose`, `subagentTail`,
// `strandedResume`, `plannedWork`, `marks` and `shellRunning` are new, for readings the copied set
// does not reach.
//
// Kept apart from `session-fixtures` because the packaged proof runs under node, which cannot
// resolve the extensionless TypeScript imports that file reaches for.
import { cp, mkdir, readFile, utimes, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { sessionArchivePath } from '../archive-store'

// Bun folds this module into a generated driver. The package script always starts in
// `apps/desktop`, which remains stable after that relocation.
const FIXTURES = path.join(
  process.cwd(),
  'src',
  'agents',
  'claude',
  'session-fake-driver',
  'fixtures',
  'sessions',
)

export const CODEX_FIXTURES = path.join(
  process.cwd(),
  'src',
  'agents',
  'codex',
  'session-fake-driver',
  'fixtures',
  'sessions',
)

export async function fixtureLines(name, fixtures = FIXTURES) {
  const text = await readFile(path.join(fixtures, `${name}.jsonl`), 'utf8')
  return text.split('\n').filter((line) => line.length > 0)
}

// A transcripts root shaped the way the CLI writes one: a directory per project holding one
// `<sessionId>.jsonl` per Session. Written in the given order, so the mtime ordering the Roster
// reads is the argument order reversed.
const PROJECT = 'project-one'

// Where one Session's transcript lands in a tree this module wrote. Owned here so a caller that
// grows a file mid-run does not keep its own copy of the layout.
export function fixturePath(root, name) {
  return path.join(root, PROJECT, `${name}.jsonl`)
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

export async function writeFixtureTree(root, names, options = {}) {
  const { directory = PROJECT, fixtures = FIXTURES } = options
  const inside = path.join(root, directory)
  await mkdir(inside, { recursive: true })
  for (const name of names) {
    await writeFile(
      path.join(inside, `${name}.jsonl`),
      `${(await fixtureLines(name, fixtures)).join('\n')}\n`,
    )
    // The Subagent transcripts the CLI keeps in a folder beside the Session's own file, for the
    // fixtures that have them. Copied as-is, so the tree matches the layout the reader walks.
    await cp(path.join(fixtures, '..', 'subagents', name), path.join(inside, name, 'subagents'), {
      recursive: true,
    }).catch(() => {})
  }
  return root
}

// Argo's own archive document (#2315): one portable file under the fixture's `userData`, keyed
// by the CLI Session id, the same shape `core/sessions/archive-store.ts` reads and writes.
export async function writeArchiveStore(userData, names) {
  const file = sessionArchivePath(userData)
  await mkdir(path.dirname(file), { recursive: true })
  const archivedAt = '2026-09-01T00:00:00.000Z'
  const document = Object.fromEntries(names.map((name) => [name, { archivedAt }]))
  await writeFile(file, `${JSON.stringify(document, null, 2)}\n`)
  return file
}
