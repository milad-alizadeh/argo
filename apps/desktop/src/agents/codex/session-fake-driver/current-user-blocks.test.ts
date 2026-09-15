import assert from 'node:assert/strict'
import test from 'node:test'
import { parseCodexTranscriptLine, withoutModelInputCopies } from '../sessions/records'
import { assertMessageBlocks, assertUserMessage } from './assert-user-message'

test('reads a current user prompt written as an input_text block', () => {
  const record = parseCodexTranscriptLine(
    JSON.stringify({
      timestamp: '2026-09-13T14:51:47.308Z',
      type: 'response_item',
      payload: {
        type: 'message',
        id: 'msg_user_1',
        role: 'user',
        content: [{ type: 'input_text', text: 'Repair the Roster.' }],
      },
    }),
  )
  assertUserMessage(record, {
    uuid: 'model-input:msg_user_1',
    blocks: [{ shape: 'prose', text: 'Repair the Roster.' }],
  })
})

test('renders a transcript-delta update compact, with the protocol text kept for diagnostics', () => {
  const record = parseCodexTranscriptLine(
    JSON.stringify({
      timestamp: '2026-09-13T14:51:47.308Z',
      type: 'response_item',
      payload: {
        type: 'message',
        id: 'msg_delta_1',
        role: 'user',
        content: [{ type: 'input_text', text: '<transcript_delta>user: hello</transcript_delta>' }],
      },
    }),
  )
  assertMessageBlocks(record, [
    {
      shape: 'event',
      event: 'transcript',
      text: null,
      raw: '<transcript_delta>user: hello</transcript_delta>',
    },
  ])
})

test('renders a status update compact, with the protocol text kept for diagnostics', () => {
  const record = parseCodexTranscriptLine(
    JSON.stringify({
      timestamp: '2026-09-13T14:51:47.308Z',
      type: 'response_item',
      payload: {
        type: 'message',
        id: 'msg_status_1',
        role: 'user',
        content: [{ type: 'input_text', text: '<status>running</status>' }],
      },
    }),
  )
  assertMessageBlocks(record, [
    { shape: 'event', event: 'status', text: 'running', raw: '<status>running</status>' },
  ])
})

test('keeps unenveloped developer text out of the prompt, since only the user speaks', () => {
  const record = parseCodexTranscriptLine(
    JSON.stringify({
      timestamp: '2026-09-13T14:51:47.308Z',
      type: 'response_item',
      payload: {
        type: 'message',
        id: 'msg_developer_1',
        role: 'developer',
        content: [{ type: 'input_text', text: 'Some harness-authored instruction.' }],
      },
    }),
  )
  assertMessageBlocks(record, [
    { shape: 'source', label: 'developer', source: 'Some harness-authored instruction.' },
  ])
})

test('skips the context Codex injects as user and developer messages', () => {
  for (const role of ['user', 'developer']) {
    assert.equal(
      parseCodexTranscriptLine(
        JSON.stringify({
          type: 'response_item',
          payload: {
            type: 'message',
            id: `msg_${role}`,
            role,
            content: [{ type: 'input_text', text: '<environment_context>' }],
          },
        }),
      ),
      null,
    )
  }
})

test('keeps a prompt input copy only in a thread with no reader copy of its prompts', () => {
  const line = (type: string, payload: Record<string, unknown>) =>
    parseCodexTranscriptLine(
      JSON.stringify({ timestamp: '2026-09-15T11:12:45.000Z', type, payload }),
    )
  const inputCopy = line('response_item', {
    type: 'message',
    id: 'msg_prompt',
    role: 'user',
    content: [{ type: 'input_text', text: 'Repair the Roster.' }],
  })
  const readerCopy = line('event_msg', {
    type: 'item_completed',
    item: {
      type: 'UserMessage',
      id: 'item-1',
      content: [{ type: 'text', text: 'Repair the Roster.' }],
    },
  })
  const uuids = (records: (typeof inputCopy)[]) =>
    withoutModelInputCopies(records.filter((record) => record !== null)).map((record) =>
      'uuid' in record ? record.uuid : null,
    )
  assert.deepEqual(uuids([inputCopy, readerCopy]), ['item-1'])
  assert.deepEqual(uuids([inputCopy]), ['model-input:msg_prompt'])
})
