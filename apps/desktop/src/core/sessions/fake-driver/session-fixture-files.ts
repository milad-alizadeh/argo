// The transcript fixture files themselves, reachable from plain node. Ten came from the
// deprecated `apps/macOS` engine's suite, which recorded the record shapes real Claude
// transcripts carry; they are owned here so this app's tests survive that app's removal and run
// under this app's path filter in CI. `askPending`, `titledHeadless`, `prose`, `subagentTail`,
// `strandedResume`, `plannedWork`, `marks` and `shellRunning` are new, for readings the copied set
// does not reach.
//
// Kept apart from `session-fixtures` because the packaged proof runs under node, which cannot
// resolve the extensionless TypeScript imports that file reaches for.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

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

export async function writeFixtureTree(root, names, options = {}) {
  const { directory = PROJECT, fixtures = FIXTURES } = options
  const inside = path.join(root, directory)
  await mkdir(inside, { recursive: true })
  for (const name of names) {
    await writeFile(
      path.join(inside, `${name}.jsonl`),
      `${(await fixtureLines(name, fixtures)).join('\n')}\n`,
    )
  }
  return root
}

// The Claude desktop app's own Session store, shaped the way that app writes one: a JSON file per
// Session two directories down, naming the CLI Session in `cliSessionId` and carrying its own
// `isArchived`. Argo reads the flag and writes nothing back, so a fixture store is all the proof
// needs to show an archived Session in the Roster's Archived section.
export async function writeArchiveStore(root, names) {
  const inside = path.join(root, 'workspace-one', PROJECT)
  await mkdir(inside, { recursive: true })
  for (const name of names) {
    await writeFile(
      path.join(inside, `local_${name}.json`),
      `${JSON.stringify({ sessionId: `desktop-${name}`, cliSessionId: name, isArchived: true })}\n`,
    )
  }
  return root
}
