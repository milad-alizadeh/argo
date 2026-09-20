// Cancelling a Session's Feed read (#2102): split from reader-feed.test.ts to stay under the
// file-length gate.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { claudeSessionSource } from '@/agents/claude/sessions/read-sessions'
import { codexSessionSource } from '@/agents/codex/sessions/read-sessions'
import { createSessionReader } from '@/domains/sessions/main/observation/reader'
import {
  appendCodexTranscript,
  fed,
  feedRequest,
  tempRoot,
  writeCodexTranscript,
} from '@/domains/sessions/main/observation/reader-test-helpers'

// Switching away from a stalled Session (#2102) sends this instead of letting the settle loop
// run to its bound with nothing left to draw the answer.
test('cancelling a Session’s Feed read answers it as cancelled instead of finishing', async (context) => {
  const claudeRoot = await tempRoot(context)
  const codexRoot = await tempRoot(context)
  await writeCodexTranscript({
    root: codexRoot,
    sessionId: 'switching',
    text: 'First.',
    updatedAt: '2026-09-13T09:00:00.000Z',
  })
  const reader = createSessionReader([
    claudeSessionSource({ transcripts: claudeRoot }),
    codexSessionSource(codexRoot),
  ])

  const read = fed(reader, feedRequest('switching'))
  const cancel = reader.cancelSessionFeed({
    version: 1,
    type: 'session.feed.cancel',
    requestId: 'cancel-1',
    sessionId: 'switching',
  })
  const [reply, cancelled] = await Promise.all([read, cancel])
  assert.equal(reply.type, 'session.error')
  assert.equal(reply.type === 'session.error' && reply.code, 'cancelled')
  assert.equal(cancelled.type, 'session.accepted')
})

test('cancelling a Session with no read in flight is a harmless no-op', async (context) => {
  const claudeRoot = await tempRoot(context)
  const codexRoot = await tempRoot(context)
  const reader = createSessionReader([
    claudeSessionSource({ transcripts: claudeRoot }),
    codexSessionSource(codexRoot),
  ])

  const cancelled = await reader.cancelSessionFeed({
    version: 1,
    type: 'session.feed.cancel',
    requestId: 'cancel-1',
    sessionId: 'nothing-pending',
  })
  assert.equal(cancelled.type, 'session.accepted')

  // A read for the same Session started afterward is unaffected by the stray cancel.
  await writeCodexTranscript({
    root: codexRoot,
    sessionId: 'nothing-pending',
    text: 'First.',
    updatedAt: '2026-09-13T09:00:00.000Z',
  })
  const reply = await fed(reader, feedRequest('nothing-pending'))
  assert.equal(reply.type, 'session.feed.read')
})

test('releases a settled Feed when its Session stops being selected', async (context) => {
  const claudeRoot = await tempRoot(context)
  const codexRoot = await tempRoot(context)
  await writeCodexTranscript({
    root: codexRoot,
    sessionId: 'released',
    text: 'First.',
    updatedAt: '2026-09-13T09:00:00.000Z',
  })
  const reader = createSessionReader([
    claudeSessionSource({ transcripts: claudeRoot }),
    codexSessionSource(codexRoot),
  ])

  const first = await fed(reader, feedRequest('released'))
  assert.equal(first.type, 'session.feed.read')
  await reader.cancelSessionFeed({
    version: 1,
    type: 'session.feed.cancel',
    requestId: 'cancel-1',
    sessionId: 'released',
  })
  await appendCodexTranscript({
    root: codexRoot,
    sessionId: 'released',
    text: 'Second.',
    updatedAt: '2026-09-13T09:00:05.000Z',
  })

  const reread = await fed(
    reader,
    feedRequest('released', 'feed-2', first.type === 'session.feed.read' ? first.revision : null),
  )
  assert.equal(reread.type, 'session.feed.read')
})
