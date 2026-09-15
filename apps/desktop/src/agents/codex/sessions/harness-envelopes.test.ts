import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseCodexTranscriptLine } from './records'

function agentMessage(text: string) {
  return parseCodexTranscriptLine(
    JSON.stringify({
      timestamp: '2026-09-15T02:00:10.000Z',
      type: 'response_item',
      payload: {
        type: 'message',
        id: 'msg-1',
        role: 'assistant',
        content: [{ type: 'output_text', text }],
      },
    }),
  )
}

function userMessage(text: string) {
  return parseCodexTranscriptLine(
    JSON.stringify({
      type: 'event_msg',
      payload: {
        type: 'item_completed',
        item: { type: 'UserMessage', id: 'user-1', content: [{ type: 'text', text }] },
      },
    }),
  )
}

test('hides a quiet heartbeat reply but keeps it as a delivery boundary', () => {
  const reply =
    '<heartbeat><automation_id>a</automation_id><decision>DONT_NOTIFY</decision><message>Nothing new.</message></heartbeat>'
  assert.deepEqual(agentMessage(reply), { kind: 'trace', uuid: 'msg-1', boundary: true })
})

test('hides the heartbeat that wakes a thread, which the person never wrote', () => {
  const wake =
    '<heartbeat><automation_id>a</automation_id><instructions>Check CI.</instructions></heartbeat>'
  assert.deepEqual(userMessage(wake), { kind: 'trace', uuid: 'user-1', boundary: true })
})

test('keeps prose that only mentions a heartbeat tag', () => {
  const text = 'The reply ends with a `<heartbeat>` block.'
  const record = agentMessage(text)
  assert.deepEqual(record?.kind === 'message' ? record.blocks : null, [{ shape: 'prose', text }])
})

test('keeps a realtime delegation with nothing said out of the Feed', () => {
  const record = userMessage(
    '<realtime_delegation><transcript_delta>user: hm</transcript_delta></realtime_delegation>',
  )
  assert.deepEqual(record, { kind: 'trace', uuid: 'user-1' })
})

test('keeps the thread Codex dispatched to review an approval out of the Roster', () => {
  const record = parseCodexTranscriptLine(
    JSON.stringify({
      type: 'session_meta',
      payload: {
        id: 'guardian-1',
        cwd: '/Users/x/argo',
        source: { subagent: { other: 'guardian' } },
        thread_source: 'guardian_review',
      },
    }),
  )
  assert.deepEqual(record, {
    kind: 'trace',
    uuid: 'guardian-1',
    subagent: true,
    cwd: '/Users/x/argo',
  })
})
