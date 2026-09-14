// Reading the Feed of a Session its CLI is still writing (#2095). The reader used to wait for two
// stat readings of the transcript to agree before it kept a chain, and a live CLI never gives it
// two that agree, so the read never returned and re-parsed the whole growing file until the heap
// was gone.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { codexSessionSource } from '../../agents/codex/sessions/read-sessions'
import { createSessionReader } from './reader'
import {
  appendCodexTranscript,
  fed,
  feedRequest,
  tempRoot,
  writeCodexTranscript,
} from './reader-test-helpers'

const SESSION = 'still-writing'
const READ_BUDGET_MS = 2_000

// The CLI writes another record every time the reader opens the transcript, so no two stat
// readings of it ever agree. This is what a streaming reply does to a poll that races it.
function sourceWrittenDuringEveryRead(root: string, writing: () => boolean) {
  const source = codexSessionSource(root)
  return {
    ...source,
    readSessionFiles: async (sessionId: string) => {
      if (writing()) {
        await appendCodexTranscript({
          root,
          sessionId: SESSION,
          text: 'still going',
          updatedAt: '2026-09-13T09:00:01.000Z',
        })
      }
      return source.readSessionFiles(sessionId)
    },
  }
}

async function liveRoot(context: Parameters<typeof tempRoot>[0]) {
  const root = await tempRoot(context)
  await writeCodexTranscript({
    root,
    sessionId: SESSION,
    text: 'First.',
    updatedAt: '2026-09-13T09:00:00.000Z',
  })
  return root
}

async function liveReader(context: Parameters<typeof tempRoot>[0], writing: () => boolean) {
  return createSessionReader([sourceWrittenDuringEveryRead(await liveRoot(context), writing)])
}

test('reads the Feed of a Session its CLI is still writing rather than spinning on it', async (context) => {
  const reader = await liveReader(context, () => true)

  const gaveUp = Symbol('gave up')
  let budget: ReturnType<typeof setTimeout> | undefined
  const reply = await Promise.race([
    fed(reader, feedRequest(SESSION)),
    new Promise((resolve) => {
      budget = setTimeout(() => resolve(gaveUp), READ_BUDGET_MS)
    }),
  ])
  clearTimeout(budget)

  assert.notEqual(reply, gaveUp, 'the read never returned against a transcript still being written')
  assert.equal((reply as Awaited<ReturnType<typeof fed>>).type, 'session.feed.read')
})

// The read that raced the writer is stamped as of before it, so what it missed is not cached as
// the whole Feed: the poll after the CLI goes quiet reads the transcript again.
test('reads the Feed again once the CLI that was writing it stops', async (context) => {
  let writing = true
  const reader = await liveReader(context, () => writing)

  const raced = await fed(reader, feedRequest(SESSION))
  assert.equal(raced.type, 'session.feed.read')
  writing = false
  const settled = await fed(reader, feedRequest(SESSION, 'feed-2', raced.revision))

  assert.equal(settled.type, 'session.feed.read', 'a racing read was cached as the whole Feed')
  assert.notEqual(settled.revision, raced.revision)
})

// A read taken while the CLI writes can catch the last record half written. It draws as one
// unreadable row rather than failing the read, and the row it belongs to arrives once the CLI
// finishes the line.
test('draws a half-written record as unreadable, and as itself once it is whole', async (context) => {
  const root = await liveRoot(context)
  const record = {
    root,
    sessionId: SESSION,
    text: 'Second.',
    updatedAt: '2026-09-13T09:00:02.000Z',
  }
  const reader = createSessionReader([codexSessionSource(root)])

  const finish = await appendCodexTranscript(record, { partial: true })
  const torn = await fed(reader, feedRequest(SESSION))
  assert.equal(torn.type, 'session.feed.read')
  assert.deepEqual(torn.type === 'session.feed.read' && torn.rows.map((row) => row.shape), [
    'prose',
    'unreadable',
  ])

  await finish()
  const whole = await fed(reader, feedRequest(SESSION, 'feed-2', torn.revision))
  assert.equal(whole.type, 'session.feed.read')
  assert.deepEqual(whole.type === 'session.feed.read' && whole.rows.map((row) => row.shape), [
    'prose',
    'prose',
  ])
})
