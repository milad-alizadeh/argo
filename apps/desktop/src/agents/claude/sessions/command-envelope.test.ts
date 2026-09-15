import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseTranscriptLine } from './records'

test('reads a sent command as its visible source text', () => {
  const line = JSON.stringify({
    type: 'user',
    uuid: 'command-1',
    message: {
      role: 'user',
      content:
        '<command-name>/implement</command-name>\n<command-message>implement</command-message>\n<command-args>1847</command-args>',
    },
  })
  const record = parseTranscriptLine(line)
  assert.deepEqual(record?.kind === 'message' ? record.blocks : null, [
    { shape: 'prose', text: '/implement 1847' },
  ])
})

test('does not expose incomplete command tags', () => {
  const line = JSON.stringify({
    type: 'user',
    uuid: 'command-2',
    message: { role: 'user', content: '<command-message>implement</command-message>' },
  })
  const record = parseTranscriptLine(line)
  assert.deepEqual(record?.kind === 'message' ? record.blocks : null, [
    { shape: 'prose', text: 'implement' },
  ])
})

// A background task's delivery arrives as a user turn holding this envelope, embedded JSON
// result included. Argo shows the summary, not the envelope (#2054).
test('reads a background task notification as its summary, not the raw envelope', () => {
  const line = JSON.stringify({
    type: 'user',
    uuid: 'task-1',
    message: {
      role: 'user',
      content:
        '<task-notification>\n<task-id>a1</task-id>\n<status>completed</status>\n<summary>Agent "Consolidate stories" finished</summary>\n<result>{"files":[{"path":"a.tsx"}]}</result>\n</task-notification>',
    },
  })
  const record = parseTranscriptLine(line)
  assert.deepEqual(record, {
    kind: 'command-output',
    uuid: 'task-1',
    timestamp: null,
    text: 'Agent "Consolidate stories" finished',
  })
})

test('drops a task notification with no summary rather than guess', () => {
  const line = JSON.stringify({
    type: 'user',
    uuid: 'task-2',
    message: {
      role: 'user',
      content: '<task-notification><status>completed</status></task-notification>',
    },
  })
  const record = parseTranscriptLine(line)
  assert.deepEqual(record, { kind: 'trace', uuid: 'task-2' })
})

test('suppresses complete known harness envelopes instead of rendering their markup', () => {
  const envelopes = [
    '<app-context>context</app-context>',
    '<apps_instructions>instructions</apps_instructions>',
    '<collaboration_mode>mode</collaboration_mode>',
    '\n<environment_context>context</environment_context>\n',
    '<local-command-caveat>caveat</local-command-caveat>',
    '<permissions>permissions</permissions>',
    '<plugins_instructions>plugins</plugins_instructions>',
    '<recommended_plugins>plugins</recommended_plugins>',
    '<realtime_delegation><input>Reader text</input></realtime_delegation>',
    '<skills_instructions>instructions</skills_instructions>',
    '<status>running</status>',
    '<transcript_delta>delivery</transcript_delta>',
    '<transcript_tail_flush>delivery</transcript_tail_flush>',
  ]
  for (const [index, content] of envelopes.entries()) {
    const uuid = `harness-${index}`
    const line = JSON.stringify({
      type: 'user',
      uuid,
      userType: 'external',
      sourceToolAssistantUUID: 'tool-1',
      message: { role: 'user', content },
    })
    assert.deepEqual(parseTranscriptLine(line), { kind: 'trace', uuid })
  }
})

test('keeps prose that happens to quote harness markup', () => {
  const line = JSON.stringify({
    type: 'user',
    uuid: 'quote-1',
    message: { role: 'user', content: 'Explain <status>running</status> to me.' },
  })
  const record = parseTranscriptLine(line)

  assert.deepEqual(record?.kind === 'message' ? record.blocks : null, [
    { shape: 'prose', text: 'Explain <status>running</status> to me.' },
  ])
})

test('keeps a known tag when it is not a complete harness envelope', () => {
  const line = JSON.stringify({
    type: 'user',
    uuid: 'status-example',
    message: { role: 'user', content: '<status>running</status> is the literal response.' },
  })
  const record = parseTranscriptLine(line)

  assert.deepEqual(record?.kind === 'message' ? record.blocks : null, [
    { shape: 'prose', text: '<status>running</status> is the literal response.' },
  ])
})

test('keeps an exact known tag when it is a person’s message', () => {
  const line = JSON.stringify({
    type: 'user',
    uuid: 'status-example-exact',
    userType: 'external',
    message: { role: 'user', content: '<status>running</status>' },
  })
  const record = parseTranscriptLine(line)

  assert.deepEqual(record?.kind === 'message' ? record.blocks : null, [
    { shape: 'prose', text: '<status>running</status>' },
  ])
})

test('keeps an unknown complete envelope as reader prose', () => {
  const line = JSON.stringify({
    type: 'user',
    uuid: 'unknown-envelope',
    message: { role: 'user', content: '<example>keep this</example>' },
  })
  const record = parseTranscriptLine(line)

  assert.deepEqual(record?.kind === 'message' ? record.blocks : null, [
    { shape: 'prose', text: '<example>keep this</example>' },
  ])
})
