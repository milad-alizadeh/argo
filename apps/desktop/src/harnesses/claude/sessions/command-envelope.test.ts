import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readTranscriptFile } from '@/domains/sessions/contract/model/transcript'
import { parseTranscriptLine } from './records'

test('reads a sent command as its visible source text', () => {
  const line = JSON.stringify({
    type: 'user',
    uuid: 'command-1',
    cwd: '/tmp/project',
    timestamp: '2026-09-15T06:00:00.000Z',
    message: {
      role: 'user',
      content:
        '<command-name>/implement</command-name>\n<command-message>implement</command-message>\n<command-args>1847</command-args>',
    },
  })
  const record = parseTranscriptLine(line)
  assert.deepEqual(record?.kind === 'message' ? record.blocks : null, [
    { shape: 'event', event: 'command', text: '/implement 1847' },
  ])
  assert.equal(record?.kind === 'message' ? record.cwd : null, '/tmp/project')
  assert.equal(record?.kind === 'message' ? record.timestamp : null, '2026-09-15T06:00:00.000Z')
})

test('does not expose incomplete command tags', () => {
  const line = JSON.stringify({
    type: 'user',
    uuid: 'command-2',
    message: { role: 'user', content: '<command-message>implement</command-message>' },
  })
  const record = parseTranscriptLine(line)
  assert.deepEqual(record?.kind === 'message' ? record.blocks : null, [
    { shape: 'event', event: 'command', text: 'implement' },
  ])
})

test('keeps a command receipt as the Session opening prompt', () => {
  const file = readTranscriptFile('/tmp/command.jsonl', {
    sessionId: 'command',
    lines: [
      JSON.stringify({
        type: 'user',
        uuid: 'command-opening',
        message: {
          role: 'user',
          content: '<command-name>/implement</command-name><command-args>2178</command-args>',
        },
      }),
    ],
    parse: parseTranscriptLine,
  })
  assert.equal(file.openingPrompt, '/implement 2178')
})

test('suppresses harness envelopes while preserving their Tool Call boundary', () => {
  const envelopes = [
    '<apps_instructions>instructions</apps_instructions>',
    '<collaboration_mode>mode</collaboration_mode>',
    '<local-command-caveat>caveat</local-command-caveat>',
    '<permissions>permissions</permissions>',
    '<plugins_instructions>plugins</plugins_instructions>',
    '<recommended_plugins>plugins</recommended_plugins>',
    '<skills_instructions>instructions</skills_instructions>',
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
    assert.deepEqual(parseTranscriptLine(line), { kind: 'trace', uuid, boundary: true })
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
