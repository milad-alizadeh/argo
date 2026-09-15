import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseTranscriptLine } from './records'

test('reads useful harness deliveries as typed reader events', () => {
  const envelopes = [
    ['app-context', '<app-context>context</app-context>', 'context', null],
    ['environment', '<environment_context>context</environment_context>', 'context', null],
    ['status', '<status>running</status>', 'status', 'running'],
    ['delta', '<transcript_delta>delivery</transcript_delta>', 'transcript', null],
    ['flush', '<transcript_tail_flush>delivery</transcript_tail_flush>', 'transcript', null],
  ] as const
  for (const [uuid, content, event, text] of envelopes) {
    const line = JSON.stringify({
      type: 'user',
      uuid,
      userType: 'external',
      sourceToolAssistantUUID: 'tool-1',
      message: { role: 'user', content },
    })
    const record = parseTranscriptLine(line)
    assert.deepEqual(record?.kind === 'message' ? record.blocks : null, [
      { shape: 'event', event, text },
    ])
  }
})

test('reads a realtime delegation input as a command receipt', () => {
  const line = JSON.stringify({
    type: 'user',
    uuid: 'delegation-1',
    userType: 'external',
    sourceToolAssistantUUID: 'tool-1',
    message: {
      role: 'user',
      content: '<realtime_delegation><input>Reader text</input></realtime_delegation>',
    },
  })
  const record = parseTranscriptLine(line)
  assert.deepEqual(record?.kind === 'message' ? record.blocks : null, [
    { shape: 'event', event: 'command', text: 'Reader text' },
  ])
})

test('suppresses a realtime delegation without reader text', () => {
  const line = JSON.stringify({
    type: 'user',
    uuid: 'delegation-empty',
    userType: 'external',
    sourceToolAssistantUUID: 'tool-1',
    message: { role: 'user', content: '<realtime_delegation></realtime_delegation>' },
  })
  assert.deepEqual(parseTranscriptLine(line), { kind: 'trace', uuid: 'delegation-empty' })
})

test('keeps an unknown external envelope as reader prose', () => {
  const line = JSON.stringify({
    type: 'user',
    uuid: 'unknown-1',
    userType: 'external',
    sourceToolAssistantUUID: 'tool-1',
    message: { role: 'user', content: '<constructor>keep this</constructor>' },
  })
  const record = parseTranscriptLine(line)
  assert.deepEqual(record?.kind === 'message' ? record.blocks : null, [
    { shape: 'prose', text: '<constructor>keep this</constructor>' },
  ])
})
