import assert from 'node:assert/strict'
import { test } from 'node:test'
import { stitchChains } from '@/domains/sessions/contract/model/transcript/chains'
import { readTranscriptFile } from '@/domains/sessions/contract/model/transcript/transcript'
import { transcriptFileFrom } from '@/domains/sessions/contract/model/transcript/transcript-file'
import { projectFeed } from '@/domains/sessions/main/projection/feed/feed-incremental'
import { readTranscriptFile as readClaudeTranscriptFile } from '../../sessions/discovery/transcript-file'
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
    { shape: 'event', event: 'skill-invocation', text: '/implement 1847' },
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

test('keeps a person-authored task notification envelope as prose', () => {
  const literal =
    '<task-notification><task-id>example</task-id><status>completed</status><summary>Example</summary></task-notification>'
  const record = parseTranscriptLine(
    JSON.stringify({
      type: 'user',
      uuid: 'literal-task-notification',
      message: { role: 'user', content: literal },
    }),
  )

  assert.equal(record?.kind, 'message')
  assert.deepEqual(record?.kind === 'message' ? record.blocks : null, [
    { shape: 'prose', text: literal },
  ])
})

test('reads Bash input and both output streams as structured records', () => {
  const parse = (uuid: string, content: string) =>
    parseTranscriptLine(
      JSON.stringify({
        type: 'user',
        uuid,
        timestamp: '2026-09-23T12:00:00.000Z',
        message: { role: 'user', content },
      }),
    )

  const input = parse('bash-input', '<bash-input>printf hello</bash-input>')
  const output = parse(
    'bash-output',
    '<bash-stdout>hello</bash-stdout><bash-stderr>warning</bash-stderr>',
  )

  assert.equal(
    input?.kind === 'message' ? input.blocks[0]?.shape === 'event' && input.blocks[0].text : null,
    '> printf hello',
  )
  assert.deepEqual(output, {
    kind: 'command-output',
    uuid: 'bash-output',
    timestamp: '2026-09-23T12:00:00.000Z',
    text: 'hello\nwarning',
  })
  const chain = stitchChains([
    transcriptFileFrom('bash.jsonl', {
      sessionId: 'bash',
      records: [input, output].filter(
        (record): record is NonNullable<typeof record> => record !== null,
      ),
    }),
  ])[0]
  assert.ok(chain)
  const rows = projectFeed(chain, undefined).rows
  assert.deepEqual(
    rows.map((row) => row.shape),
    ['event', 'command-output'],
  )
  assert.equal(
    rows.some((row) => /<\/?bash-/.test(JSON.stringify(row))),
    false,
  )
  const emptyOutput = parse('bash-empty', '<bash-stdout></bash-stdout>')
  assert.deepEqual(emptyOutput?.kind === 'command-output' ? emptyOutput.text : null, '')
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

test('projects a skill invocation and a task notification from transcript files', () => {
  const file = readClaudeTranscriptFile('/tmp/envelopes.jsonl', {
    sessionId: 'envelopes',
    lines: [
      JSON.stringify({
        type: 'user',
        uuid: 'skill-command',
        message: {
          role: 'user',
          content:
            '<command-name>/to-spec</command-name><command-message>to-spec</command-message><command-args>https://github.com/milad-alizadeh/argo/issues/2669</command-args>',
        },
      }),
      JSON.stringify({
        type: 'user',
        uuid: 'task-delivery',
        userType: 'external',
        sourceToolAssistantUUID: 'task-call',
        message: {
          role: 'user',
          content:
            '<task-notification><task-id>a64dd851fde47a6f0</task-id><tool-use-id>toolu_016x6ep9fsq1pPsDheEqy92</tool-use-id><status>completed</status><summary>Agent "Explore turn setup and harness code for issue 2669" finished</summary><result>Issue is understood.</result></task-notification>',
        },
      }),
    ],
  })
  const chain = stitchChains([file])[0]
  assert.ok(chain)
  const rows = projectFeed(chain, undefined).rows

  assert.deepEqual(
    rows.map((row) => {
      switch (row.shape) {
        case 'event':
          return `${row.event}:${row.text}`
        case 'subagent':
          return `${row.event}:${row.subagentId}:${row.name}`
        default:
          return row.shape
      }
    }),
    [
      'skill-invocation:/to-spec https://github.com/milad-alizadeh/argo/issues/2669',
      'responded:toolu_016x6ep9fsq1pPsDheEqy92:Explore turn setup and harness code for issue 2669',
    ],
  )
  assert.equal(
    rows.some((row) =>
      /<\/?(?:command-name|task-notification|task-id|status)>/.test(JSON.stringify(row)),
    ),
    false,
  )
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
