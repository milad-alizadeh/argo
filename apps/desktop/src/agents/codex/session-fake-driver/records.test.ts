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
