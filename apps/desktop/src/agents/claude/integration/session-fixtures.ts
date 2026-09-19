// The fixtures above, read through the module under test. Bun runs these; see
// `session-fixture-files.mjs` for the half plain node can reach.
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { claudeSessionSource } from '@/agents/claude/sessions/read-sessions.ts'
import { readTranscriptFile } from '@/agents/claude/sessions/transcript-file.ts'
import { stitchChains } from '@/domains/sessions/contract/chains.ts'
import { createSessionReader } from '@/domains/sessions/main/reader'
import { projectRosterRow } from '@/domains/sessions/main/roster.ts'
import { fixtureLines, writeFixtureTree } from '../../../../mocks/sessions/mock-transcript-files'

export const unscopedListing = {
  version: 1,
  type: 'session.list',
  requestId: 'list-1',
  projectRoot: null,
}

export function listSessions(value: unknown, root: string) {
  return createSessionReader([claudeSessionSource({ transcripts: root })]).listSessions(value)
}

export const LATER_TURN = `${JSON.stringify({
  type: 'assistant',
  uuid: 'e-a-2',
  parentUuid: 'e-a-1',
  timestamp: '2026-09-01T08:00:00.000Z',
  message: {
    role: 'assistant',
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: 'Done.' }],
  },
})}\n`

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
