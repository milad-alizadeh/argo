import assert from 'node:assert/strict'
import { readdir, utimes } from 'node:fs/promises'
import { type TestContext, test } from 'node:test'
import {
  appendCodexRecord,
  fed,
  feedRequest,
  listed,
  tempRoot,
  writeCodexTranscript,
} from '@/core/sessions/reader-test-helpers'
import { writeCompactionStart } from '../../compaction/compaction-start-fixture'
import { createCodexSessionReader } from '../sessions/read-sessions'

const SESSION = '01a0a6eb-56c8-7f93-8820-cc80e2f234d3'
const MINUTE = 60_000

async function compactingSession(context: TestContext) {
  const transcripts = await tempRoot(context)
  const starts = await tempRoot(context)
  const startedAt = new Date(Date.now() - MINUTE)
  await writeCodexTranscript({
    root: transcripts,
    sessionId: SESSION,
    text: 'Done.',
    updatedAt: new Date(startedAt.getTime() - 10_000).toISOString(),
  })
  await writeCompactionStart(starts, SESSION, startedAt)
  const reader = createCodexSessionReader(transcripts, { compactionStarts: starts })
  return { transcripts, starts, reader, startedAt }
}

async function compactionStartedAt(reader: ReturnType<typeof createCodexSessionReader>) {
  const row = (await listed(reader))?.sessions.find((session) => session.id === SESSION)
  assert.ok(row, 'The Session is missing from the Roster.')
  return row.compactionStartedAt ?? null
}

// The record codex-cli 0.147.0 writes once it has replaced the context, trimmed from a live rollout.
async function appendCompacted(transcripts: string, startedAt: Date) {
  const file = await appendCodexRecord(
    { root: transcripts, sessionId: SESSION },
    {
      timestamp: new Date(startedAt.getTime() + 45_000).toISOString(),
      type: 'compacted',
      payload: { message: '', replacement_history: [] },
    },
  )
  const later = new Date(Date.now() + MINUTE)
  await utimes(file, later, later)
}

test('an outside Codex Session reads compacting from the moment its hook saw the start', async (context) => {
  const { reader, startedAt } = await compactingSession(context)
  assert.equal(await compactionStartedAt(reader), startedAt.toISOString())
})

test('the compacted record ends a Codex compaction and removes its start file', async (context) => {
  const { reader, transcripts, starts, startedAt } = await compactingSession(context)
  await appendCompacted(transcripts, startedAt)
  assert.equal(await compactionStartedAt(reader), null)
  assert.deepEqual(await readdir(starts), [])
})

test('a Codex compaction draws the compaction divider in the Feed', async (context) => {
  const { reader, transcripts, startedAt } = await compactingSession(context)
  await appendCompacted(transcripts, startedAt)
  await listed(reader)
  const reply = await fed(reader, feedRequest(SESSION))
  assert.equal(reply.type, 'session.feed.read')
  const rows = reply.type === 'session.feed.read' ? reply.rows : []
  assert.deepEqual(
    rows.filter((row) => row.shape === 'marker').map((row) => row.shape === 'marker' && row.marker),
    ['compacted'],
  )
})
