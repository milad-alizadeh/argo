// A poll while a Harness appends must not resend rows the renderer already holds (#2145): a poll that
// finds nothing new still gets `session.feed.unchanged`, and one that finds only an append gets
// `session.feed.appended` naming how much of the caller's own copy is still good.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSessionReader } from '@/domains/sessions/main/observation/reader'
import {
  appendCodexTranscript,
  fed,
  feedRequest,
  tempRoot,
  writeCodexTranscript,
} from '@/domains/sessions/main/observation/reader-test-helpers'
import { codexSessionSource } from '@/harnesses/codex/sessions/read-sessions'

const SESSION = 'incremental'

function line(root: string, text: string) {
  return { root, sessionId: SESSION, text, updatedAt: '2026-09-13T09:00:00.000Z' }
}

test('a poll with no new rows gets unchanged even while the reader keeps re-deriving the chain', async (context) => {
  const root = await tempRoot(context)
  await writeCodexTranscript(line(root, 'First.'))
  const reader = createSessionReader([codexSessionSource(root)])

  const first = await fed(reader, feedRequest(SESSION))
  assert.equal(first.type, 'session.feed.read')

  const again = await fed(reader, feedRequest(SESSION, 'feed-2', first.revision))
  assert.equal(again.type, 'session.feed.unchanged')
})

test('an appended reply names exactly the rows the caller already holds', async (context) => {
  const root = await tempRoot(context)
  await writeCodexTranscript(line(root, 'First.'))
  const reader = createSessionReader([codexSessionSource(root)])

  const first = await fed(reader, feedRequest(SESSION))
  assert.equal(first.type, 'session.feed.read')
  assert.equal(first.rows.length, 1)

  await appendCodexTranscript(line(root, 'Second.'))
  const appended = await fed(reader, feedRequest(SESSION, 'feed-2', first.revision))
  assert.equal(appended.type, 'session.feed.appended')
  if (appended.type !== 'session.feed.appended') return
  assert.equal(appended.unchangedRowCount, first.rows.length)
  assert.deepEqual(
    [...first.rows.slice(0, appended.unchangedRowCount), ...appended.rows].map((row) =>
      row.shape === 'prose' ? row.text : row.shape,
    ),
    ['First.', 'Second.'],
  )

  await appendCodexTranscript(line(root, 'Third.'))
  const appendedAgain = await fed(reader, feedRequest(SESSION, 'feed-3', appended.revision))
  assert.equal(appendedAgain.type, 'session.feed.appended')
  if (appendedAgain.type !== 'session.feed.appended') return
  // The second poll's own delta had already frozen, so the third poll's unchanged count covers it too.
  assert.equal(appendedAgain.unchangedRowCount, appended.unchangedRowCount + appended.rows.length)
})

test('a caller with a stale revision still gets the whole Feed rather than a delta it cannot apply', async (context) => {
  const root = await tempRoot(context)
  await writeCodexTranscript(line(root, 'First.'))
  const reader = createSessionReader([codexSessionSource(root)])

  const first = await fed(reader, feedRequest(SESSION))
  assert.equal(first.type, 'session.feed.read')

  await appendCodexTranscript(line(root, 'Second.'))
  // No revision named: a fresh caller, or one that dropped its cache, asks for the whole thing.
  const whole = await fed(reader, feedRequest(SESSION, 'feed-2'))
  assert.equal(whole.type, 'session.feed.read')
  assert.deepEqual(
    whole.type === 'session.feed.read' &&
      whole.rows.map((row) => (row.shape === 'prose' ? row.text : row.shape)),
    ['First.', 'Second.'],
  )
})
