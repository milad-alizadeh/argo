import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseCodexTranscriptLine } from '@/agents/codex/sessions/records'

test('reads completed and aborted root Turns as neutral lifecycle records', () => {
  const completed = parseCodexTranscriptLine(
    JSON.stringify({
      timestamp: '2026-09-16T00:00:10.000Z',
      type: 'event_msg',
      payload: { type: 'task_complete', turn_id: 'turn-1' },
    }),
  )
  const aborted = parseCodexTranscriptLine(
    JSON.stringify({
      timestamp: '2026-09-16T00:00:11.000Z',
      type: 'event_msg',
      payload: { type: 'turn_aborted', turn_id: 'turn-2' },
    }),
  )
  assert.deepEqual(completed, {
    kind: 'turn',
    uuid: 'turn:turn-1',
    state: 'completed',
    timestamp: '2026-09-16T00:00:10.000Z',
  })
  assert.deepEqual(aborted, {
    kind: 'turn',
    uuid: 'turn:turn-2',
    state: 'aborted',
    timestamp: '2026-09-16T00:00:11.000Z',
  })
})

test('reads root Turn setup and cumulative token usage without reading subagent setup', () => {
  const setup = (rootTurnId: string) =>
    parseCodexTranscriptLine(
      JSON.stringify({
        type: 'turn_context',
        payload: {
          turn_id: 'turn-1',
          root_turn_id: rootTurnId,
          model: 'gpt-6-astra',
          effort: 'high',
          collaboration_mode: { mode: 'Default' },
        },
      }),
    )
  assert.deepEqual(setup('turn-1'), {
    kind: 'setup',
    startsTurn: true,
    model: 'gpt-6-astra',
    effort: 'high',
    mode: 'Default',
  })
  assert.equal(setup('parent-turn'), null)
  assert.deepEqual(
    parseCodexTranscriptLine(
      JSON.stringify({
        type: 'token_usage_record',
        payload: {
          turn_token_usage: { total_tokens: 1200 },
          thread_token_usage: { total_tokens: 4500 },
        },
      }),
    ),
    { kind: 'usage', contextTokens: 1200, spentTokens: 4500 },
  )
})
