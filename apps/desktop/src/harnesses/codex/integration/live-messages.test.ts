import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createLiveMessages } from '@/harnesses/codex/drive/live-messages'

const delta = (itemId: string, text: string, threadId = 'thread-1') => ({
  method: 'item/agentMessage/delta',
  params: { threadId, turnId: 'turn-1', itemId, delta: text },
})

const completed = (itemId: string, text: string) => ({
  method: 'item/completed',
  params: {
    threadId: 'thread-1',
    turnId: 'turn-1',
    item: { type: 'agentMessage', id: itemId, text },
  },
})

test('holds the agent messages a Turn is still writing, delta by delta, for its own thread', () => {
  const live = createLiveMessages('thread-1')
  for (const message of [
    delta('msg-1', 'Ducks'),
    delta('msg-1', ' glide.'),
    delta('msg-2', 'They swim.'),
    delta('msg-3', 'Another thread.', 'thread-other'),
  ]) {
    assert.equal(live.record(message), true)
  }
  assert.deepEqual(live.list(), [
    { id: 'msg-1', text: 'Ducks glide.' },
    { id: 'msg-2', text: 'They swim.' },
  ])
})

test('takes the completed text of a message over what streamed', () => {
  const live = createLiveMessages('thread-1')
  live.record(delta('msg-1', 'Ducks gl'))
  live.record(completed('msg-1', 'Ducks glide.'))
  assert.deepEqual(live.list(), [{ id: 'msg-1', text: 'Ducks glide.' }])
})

test('leaves other notifications, and a malformed delta, to the rest of the driver', () => {
  const live = createLiveMessages('thread-1')
  assert.equal(live.record({ method: 'turn/completed', params: { threadId: 'thread-1' } }), false)
  assert.equal(
    live.record({ method: 'item/agentMessage/delta', params: { threadId: 'thread-1' } }),
    false,
  )
  assert.deepEqual(live.list(), [])
})
