// The fixtures above, read through the module under test. Bun runs these; see
// `session-fixture-files.mjs` for the half plain node can reach.
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fixtureLines, writeFixtureTree } from '@/core/sessions/fake-driver/session-fixture-files'
import { stitchChains } from '../sessions/chains.ts'
import { projectRosterRow } from '../sessions/roster.ts'
import { readTranscriptFile } from '../sessions/transcript-file.ts'

export async function fixtureFile(name) {
  return readTranscriptFile(`/fixtures/${name}.jsonl`, {
    fileName: `${name}.jsonl`,
    lines: await fixtureLines(name),
  })
}

export async function fixtureFiles(names) {
  return Promise.all(names.map((name) => fixtureFile(name)))
}

export async function fixtureRoot(context, names, directory = 'project-one') {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-sessions-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  return writeFixtureTree(root, names, { directory })
}

// The Roster row the named fixtures project into, which is what most signal tests assert on.
export async function fixtureRosterRow(names) {
  return projectRosterRow(stitchChains(await fixtureFiles(names))[0])
}
