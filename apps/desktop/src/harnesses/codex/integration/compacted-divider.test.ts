import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSessionReader } from '@/domains/sessions/main/observation/reader'
import {
  appendCodexRecord,
  fed,
  feedRequest,
  listed,
  tempRoot,
  writeCodexTranscript,
} from '@/domains/sessions/main/observation/reader-test-helpers'
import { codexSessionSource } from '@/harnesses/codex/sessions/read-sessions'

const SESSION = '01a0a6eb-56c8-7f93-8820-cc80e2f234d3'

test('a Codex compaction draws the compaction divider in the Feed', async (context) => {
  const transcripts = await tempRoot(context)
  await writeCodexTranscript({
    root: transcripts,
    sessionId: SESSION,
    text: 'Done.',
    updatedAt: '2026-09-15T22:28:00.000Z',
  })
  // The record codex-harness 0.147.0 writes once it has replaced the context, trimmed from a live rollout.
  await appendCodexRecord(
    { root: transcripts, sessionId: SESSION },
    {
      timestamp: '2026-09-15T22:28:47.000Z',
      type: 'compacted',
      payload: { message: '', replacement_history: [] },
    },
  )
  const reader = createSessionReader([codexSessionSource(transcripts)])
  await listed(reader)

  const reply = await fed(reader, feedRequest(SESSION))

  assert.equal(reply.type, 'session.feed.read')
  const rows = reply.type === 'session.feed.read' ? reply.rows : []
  assert.deepEqual(
    rows.filter((row) => row.shape === 'marker').map((row) => row.shape === 'marker' && row.marker),
    ['compacted'],
  )
})
