import assert from 'node:assert/strict'
import test from 'node:test'
import { parseCodexTranscriptLine } from '../sessions/records'
import { assertUserMessage } from './assert-user-message'

test('keeps malformed Codex evidence visible as unreadable', () => {
  assert.deepEqual(parseCodexTranscriptLine('{'), { kind: 'unreadable', line: '{' })
})

test('skips Codex events outside the Session evidence contract', () => {
  assert.equal(
    parseCodexTranscriptLine(
      JSON.stringify({ type: 'event_msg', payload: { type: 'turn_started' } }),
    ),
    null,
  )
})

test('reads the model context window declared when a Codex Turn starts', () => {
  assert.deepEqual(
    parseCodexTranscriptLine(
      JSON.stringify({
        type: 'event_msg',
        payload: {
          type: 'task_started',
          turn_id: '01a0b000-0000-7000-8000-00000000a001',
          model_context_window: 258_400,
        },
      }),
    ),
    {
      kind: 'trace',
      uuid: 'task-started:01a0b000-0000-7000-8000-00000000a001',
      contextWindowTokens: 258_400,
    },
  )
})

test('reads the record Codex writes once it has compacted the context', () => {
  assert.deepEqual(
    parseCodexTranscriptLine(
      JSON.stringify({
        timestamp: '2026-09-15T00:30:36.403Z',
        type: 'compacted',
        payload: { message: '', replacement_history: [] },
      }),
    ),
    {
      kind: 'compaction',
      uuid: 'compacted:2026-09-15T00:30:36.403Z',
      timestamp: '2026-09-15T00:30:36.403Z',
    },
  )
})

// The two record shapes codex-cli 0.147.0 writes for an app-server Turn, trimmed from a live rollout.
test('reads the assistant message under the id its deltas streamed with', () => {
  assert.deepEqual(
    parseCodexTranscriptLine(
      JSON.stringify({
        timestamp: '2026-09-13T14:51:49.782Z',
        type: 'response_item',
        payload: {
          type: 'message',
          id: 'msg_04e6',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'Ducks glide calmly across the water.' }],
          phase: 'final_answer',
        },
      }),
    ),
    {
      kind: 'message',
      uuid: 'msg_04e6',
      parentUuid: null,
      originSessionId: null,
      role: 'assistant',
      sidechain: false,
      cwd: null,
      branch: null,
      timestamp: '2026-09-13T14:51:49.782Z',
      entry: 'interactive',
      stopReason: null,
      model: null,
      effort: null,
      mode: null,
      blocks: [{ shape: 'prose', text: 'Ducks glide calmly across the water.' }],
      toolCalls: [],
      toolResults: [],
      answeredCalls: [],
      usage: null,
    },
  )
})

test('reads the prompt the person wrote, keyed by when it was written', () => {
  const record = parseCodexTranscriptLine(
    JSON.stringify({
      timestamp: '2026-09-13T14:51:47.308Z',
      type: 'event_msg',
      payload: { type: 'user_message', message: 'Write about ducks.', images: [] },
    }),
  )
  assertUserMessage(record, {
    uuid: 'user:2026-09-13T14:51:47.308Z',
    blocks: [{ shape: 'prose', text: 'Write about ducks.' }],
  })
})

test('does not invent a message when Codex omits its identity', () => {
  assert.equal(
    parseCodexTranscriptLine(
      JSON.stringify({
        type: 'event_msg',
        payload: {
          type: 'agent_message',
          item: { type: 'AgentMessage', content: [{ type: 'text', text: 'missing id' }] },
        },
      }),
    ),
    null,
  )
})
