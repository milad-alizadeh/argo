import assert from 'node:assert/strict'
import test from 'node:test'
import { parseCodexTranscriptLine } from '../sessions/records'

function completed(item: unknown) {
  return parseCodexTranscriptLine(
    JSON.stringify({
      timestamp: '2026-09-13T23:01:10.592Z',
      type: 'event_msg',
      payload: {
        type: 'item_completed',
        thread_id: 'thread-1',
        turn_id: 'turn-1',
        item,
      },
    }),
  )
}

function messageReading(item: unknown) {
  const record = completed(item)
  if (record?.kind !== 'message') return record
  return {
    uuid: record.uuid,
    role: record.role,
    originSessionId: record.originSessionId,
    blocks: record.blocks,
  }
}

test('reads current completed user and agent messages', () => {
  assert.deepEqual(
    [
      messageReading({
        type: 'UserMessage',
        id: 'item-1',
        content: [{ type: 'text', text: 'Repair the Roster.', text_elements: [] }],
      }),
      messageReading({
        type: 'AgentMessage',
        id: 'msg-1',
        content: [{ type: 'Text', text: 'I repaired it.' }],
      }),
    ],
    [
      {
        uuid: 'item-1',
        role: 'user',
        originSessionId: 'thread-1',
        blocks: [{ shape: 'prose', text: 'Repair the Roster.' }],
      },
      {
        uuid: 'msg-1',
        role: 'assistant',
        originSessionId: 'thread-1',
        blocks: [{ shape: 'prose', text: 'I repaired it.' }],
      },
    ],
  )
})

test('keeps unsupported completed blocks honest', () => {
  const unsupported = completed({
    type: 'UserMessage',
    id: 'item-1',
    content: [{ type: 'LocalImage', path: '/tmp/image.png' }],
  })
  assert.equal(unsupported?.kind, 'message')
  if (unsupported?.kind !== 'message') return
  assert.deepEqual(unsupported.blocks, [
    {
      shape: 'source',
      label: 'LocalImage',
      source: '{\n  "type": "LocalImage",\n  "path": "/tmp/image.png"\n}',
    },
  ])
})

test('refuses partial completed messages', () => {
  assert.equal(completed({ type: 'UserMessage', id: 'item-2' }), null)
})
