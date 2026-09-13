import assert from 'node:assert/strict'
import test from 'node:test'
import { parseCodexTranscriptLine } from '../sessions/records'

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
  assert.equal(record?.kind, 'message')
  if (record?.kind !== 'message') return
  assert.deepEqual(
    { uuid: record.uuid, role: record.role, blocks: record.blocks },
    {
      uuid: 'user:2026-09-13T14:51:47.308Z',
      role: 'user',
      blocks: [{ shape: 'prose', text: 'Write about ducks.' }],
    },
  )
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
