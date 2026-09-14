// The reader keeps what it parsed of a transcript and reads only the bytes after it (#2127). These
// cases hold the Feed to the file's whole content whatever the CLI did to it between two reads.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { codexSessionSource } from '../../agents/codex/sessions/read-sessions'
import { createSessionReader } from './reader'
import {
  appendCodexTranscript,
  appendGarbledCodexLine,
  fed,
  feedRequest,
  tempRoot,
  writeCodexTranscript,
} from './reader-test-helpers'

const SESSION = 'appended'

function line(root: string, text: string) {
  return { root, sessionId: SESSION, text, updatedAt: '2026-09-13T09:00:00.000Z' }
}

async function openedFeed(context: Parameters<typeof tempRoot>[0], text: string) {
  const root = await tempRoot(context)
  await writeCodexTranscript(line(root, text))
  const reader = createSessionReader([codexSessionSource(root)])
  const first = await fed(reader, feedRequest(SESSION))
  assert.equal(first.type, 'session.feed.read')
  const next = async () => {
    const reply = await fed(reader, feedRequest(SESSION, 'feed-2'))
    assert.equal(reply.type, 'session.feed.read')
    return reply.type === 'session.feed.read' ? reply.rows : []
  }
  return { root, next }
}

function texts(rows: { shape: string; text?: string }[]) {
  return rows.map((row) => (row.shape === 'prose' ? row.text : row.shape))
}

test('draws the records a CLI appends after the Feed was read', async (context) => {
  const { root, next } = await openedFeed(context, 'First.')

  await appendCodexTranscript(line(root, 'Second.'))
  await appendCodexTranscript(line(root, 'Third.'))

  assert.deepEqual(texts(await next()), ['First.', 'Second.', 'Third.'])
})

test('draws a record longer than one read of the file', async (context) => {
  const long = 'x'.repeat(3 * 1024 * 1024)
  const { root, next } = await openedFeed(context, 'First.')

  await appendCodexTranscript(line(root, long))
  await appendCodexTranscript(line(root, 'Third.'))

  assert.deepEqual(texts(await next()), ['First.', long, 'Third.'])
})

test('reads a transcript rewritten in place from its start', async (context) => {
  const { root, next } = await openedFeed(context, 'First.')

  await writeCodexTranscript(line(root, 'Rewritten, and longer than the first one.'))

  assert.deepEqual(texts(await next()), ['Rewritten, and longer than the first one.'])
})

test('reads a transcript cut shorter from its start', async (context) => {
  const { root, next } = await openedFeed(context, 'First, and longer than the rewrite.')
  await appendCodexTranscript(line(root, 'Second.'))
  await next()

  await writeCodexTranscript(line(root, 'Only.'))

  assert.deepEqual(texts(await next()), ['Only.'])
})

test('still draws a whole line the CLI wrote that is not a record', async (context) => {
  const { root, next } = await openedFeed(context, 'First.')

  await appendGarbledCodexLine({ root, sessionId: SESSION })
  await appendCodexTranscript(line(root, 'Second.'))

  assert.deepEqual(texts(await next()), ['First.', 'unreadable', 'Second.'])
})
