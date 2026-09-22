import assert from 'node:assert/strict'
import test from 'node:test'
import { withoutModelInputCopies } from '@/harnesses/codex/sessions/model-input-copies'
import { parseCodexTranscriptLine } from '@/harnesses/codex/sessions/records'
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

function injected(role: string, text: string) {
  return parseCodexTranscriptLine(
    JSON.stringify({
      type: 'response_item',
      payload: {
        type: 'message',
        id: `msg_${role}`,
        role,
        content: [{ type: 'input_text', text }],
      },
    }),
  )
}

test('hides developer text, which Codex writes only to instruct the model', () => {
  const text = 'You are `/root`, the primary agent in a team of agents.'
  assert.equal(injected('developer', text), null)
})

test('skips the context Codex injects as user and developer messages', () => {
  const contexts = [
    '<environment_context>',
    '<app-context>\n# Codex desktop context\n</app-context>',
    '<collaboration_mode># Collaboration Mode: Default</collaboration_mode>',
    '<multi_agent_mode>\nYou are in multi-agent mode.\n</multi_agent_mode>',
    '<recommended_plugins>\n- Figma\n</recommended_plugins>',
    '<codex_internal_context source="goal">\nKeep going.\n</codex_internal_context>',
    '# AGENTS.md instructions for /Users/x/argo\n\n<INSTRUCTIONS>\n# Argo\n</INSTRUCTIONS>',
  ]
  for (const role of ['user', 'developer'])
    for (const text of contexts) assert.equal(injected(role, text), null, text)
})

test('keeps a user message that only mentions AGENTS.md', () => {
  assertMessageBlocks(injected('user', '# AGENTS.md instructions look wrong, fix them'), [
    { shape: 'prose', text: '# AGENTS.md instructions look wrong, fix them' },
  ])
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
