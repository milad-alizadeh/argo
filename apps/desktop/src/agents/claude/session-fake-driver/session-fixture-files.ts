// The transcript fixture files themselves, reachable from plain node. Ten came from the
// deprecated `apps/macOS` engine's suite, which recorded the record shapes real Claude
// transcripts carry; they are owned here so this app's tests survive that app's removal and run
// under this app's path filter in CI. `askPending`, `titledHeadless`, `prose`, `subagentTail` and
// `strandedResume` are new, for readings the copied set does not reach.
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

export async function fixtureLines(name) {
  const text = await readFile(path.join(FIXTURES, `${name}.jsonl`), 'utf8')
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

export async function writeFixtureTree(root, names, directory = PROJECT) {
  const inside = path.join(root, directory)
  await mkdir(inside, { recursive: true })
  for (const name of names) {
    await writeFile(
      path.join(inside, `${name}.jsonl`),
      `${(await fixtureLines(name)).join('\n')}\n`,
    )
  }
  return root
}
