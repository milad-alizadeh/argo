import { readFileSync } from 'node:fs'
import type { SDKMessage, SessionMessage } from '@anthropic-ai/claude-agent-sdk'
import { expect, test } from 'vitest'
import { decodeClaudeHistoryContent, decodeClaudeLiveContent } from './claude-feed-decoder'

const recorded = readFileSync(
  new URL(
    '../../../../mocks/cli/claude/fixtures/session-history-envelope-corpus.jsonl',
    import.meta.url,
  ),
  'utf8',
)
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line) as SessionMessage)

function recordedSession(name: string): SessionMessage[] {
  return readFileSync(
    new URL(`../../../../mocks/cli/claude/fixtures/sessions/${name}.jsonl`, import.meta.url),
    'utf8',
  )
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as SessionMessage)
    .filter((entry) => ['user', 'assistant'].includes(entry.type))
}

test('uses the same assistant identity for live replies and SDK history', () => {
  const message = {
    role: 'assistant',
    id: 'msg-api-1',
    content: [{ type: 'text', text: 'Argo live feed verified.' }],
  }
  const history = decodeClaudeHistoryContent(
    { type: 'assistant', uuid: 'history-envelope-1', message } as SessionMessage,
    () => {},
  )
  const live = decodeClaudeLiveContent(
    {
      type: 'assistant',
      uuid: 'live-envelope-1',
      session_id: 'session-1',
      message,
    } as unknown as SDKMessage,
    () => {},
  )
  expect(history).toEqual([
    { id: 'msg-api-1', kind: 'message', role: 'assistant', text: 'Argo live feed verified.' },
  ])
  expect(live).toEqual(history)
})

test('renders a Claude history compaction summary as a marker', () => {
  const rejected: string[] = []
  const message = {
    type: 'user',
    uuid: 'compact-summary-1',
    session_id: 'session-1',
    isCompactSummary: true,
    is_meta: true,
    message: {
      role: 'user',
      content:
        'This session is being continued from a previous conversation that ran out of context. The summary begins here.',
    },
  } as unknown as SessionMessage

  expect(decodeClaudeHistoryContent(message, (shape) => rejected.push(shape))).toEqual([
    { id: 'compact-summary-1', kind: 'marker', marker: 'compaction', summary: null },
  ])
  expect(rejected).toEqual([])
})

test('ignores Claude tool reference metadata without rejecting the tool result', () => {
  const rejected: string[] = []
  const message = {
    type: 'user',
    uuid: 'result-with-tool-reference',
    session_id: 'session-1',
    message: {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'call-1',
          content: [
            { type: 'text', text: 'Done.' },
            { type: 'tool_reference', tool_name: 'Bash' },
          ],
        },
      ],
    },
  } as unknown as SessionMessage

  expect(decodeClaudeHistoryContent(message, (shape) => rejected.push(shape))).toEqual([
    {
      id: 'result-with-tool-reference',
      kind: 'tool',
      callId: 'call-1',
      name: '',
      status: 'completed',
      input: null,
      output: [{ kind: 'text', text: 'Done.' }],
      summary: null,
    },
  ])
  expect(rejected).toEqual([])
})

test('decodes recorded command, task, and delegation shapes', () => {
  const rejected: string[] = []
  const decoded = recordedSession('harnessNoise').flatMap((entry) =>
    decodeClaudeHistoryContent(entry, (shape) => rejected.push(shape)),
  )
  expect(decoded).toContainEqual(
    expect.objectContaining({ id: 'u-effort', kind: 'command', command: '/effort' }),
  )
  expect(decoded).toContainEqual(
    expect.objectContaining({
      id: 'u-implement',
      kind: 'command',
      command: '/implement 318 open storybook while you do it',
    }),
  )
  expect(decoded).toContainEqual(
    expect.objectContaining({
      id: 'u-delegation',
      kind: 'delegation',
      agentId: 'feed-review',
      status: 'running',
    }),
  )
  expect(decoded).toContainEqual(
    expect.objectContaining({
      id: 'u-shell-start',
      kind: 'task',
      taskId: 'build',
      status: 'running',
    }),
  )
  expect(decoded).toContainEqual({
    id: 'u-quoted',
    kind: 'message',
    role: 'user',
    text: 'Quote <local-command-caveat>this markup</local-command-caveat> exactly.',
  })
  expect(rejected).toEqual([])
})

test('decodes recorded Claude command and task envelopes before they reach the Feed', () => {
  const rejected: string[] = []
  expect(
    recorded.flatMap((message) =>
      decodeClaudeHistoryContent(message, (shape) => rejected.push(shape)),
    ),
  ).toEqual([
    {
      id: 'recorded-skill-invocation',
      kind: 'command',
      command: '/to-spec https://example.invalid/issues/1',
      cwd: null,
      status: 'completed',
      output: null,
      stderr: null,
      exitCode: null,
    },
    {
      id: 'recorded-task-notification',
      kind: 'task',
      taskId: 'agent-recorded',
      callId: 'toolu_recorded',
      status: 'completed',
      description: null,
      summary: 'Agent "Review the Feed card" finished',
    },
  ])
  expect(rejected).toEqual([])
})

test('preserves human text that looks like a supported Claude envelope', () => {
  const rejected: string[] = []
  const humanPrompt = {
    type: 'user',
    uuid: 'human-envelope-text',
    session_id: 'session-1',
    origin: { kind: 'human' },
    message: { role: 'user', content: '<system-reminder>Hello</system-reminder>' },
  } as unknown as SessionMessage

  expect(decodeClaudeHistoryContent(humanPrompt, (shape) => rejected.push(shape))).toEqual([
    {
      id: 'human-envelope-text',
      kind: 'message',
      role: 'user',
      text: '<system-reminder>Hello</system-reminder>',
    },
  ])
  expect(rejected).toEqual([])
})

test('keeps Claude block identity and tool relationships without flattening content to prose', () => {
  const rejected: string[] = []
  const assistant = {
    type: 'assistant',
    uuid: 'assistant-1',
    session_id: 'session-1',
    message: {
      role: 'assistant',
      content: [
        { type: 'thinking', thinking: 'First check the file.' },
        { type: 'text', text: 'I will inspect it.' },
        { type: 'tool_use', id: 'call-1', name: 'Read', input: { file_path: '/tmp/a' } },
      ],
    },
  } as unknown as SDKMessage
  const result = {
    type: 'user',
    uuid: 'result-1',
    session_id: 'session-1',
    message: {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'call-1',
          content: [{ type: 'text', text: 'file body' }],
        },
      ],
    },
  } as unknown as SDKMessage
  expect(decodeClaudeLiveContent(assistant, (shape) => rejected.push(shape))).toEqual([
    { id: 'assistant-1:0', kind: 'reasoning', text: 'First check the file.', redacted: false },
    { id: 'assistant-1:1', kind: 'message', role: 'assistant', text: 'I will inspect it.' },
    {
      id: 'assistant-1:2',
      kind: 'tool',
      callId: 'call-1',
      name: 'Read',
      status: 'running',
      input: { file_path: '/tmp/a' },
      output: null,
      summary: null,
      presentation: { kind: 'read', label: 'Read /tmp/a' },
    },
  ])
  expect(decodeClaudeLiveContent(result, (shape) => rejected.push(shape))).toEqual([
    {
      id: 'result-1',
      kind: 'tool',
      callId: 'call-1',
      name: '',
      status: 'completed',
      input: null,
      output: [{ kind: 'text', text: 'file body' }],
      summary: null,
    },
  ])
  expect(rejected).toEqual([])
})

test('keeps the Claude Code description as the command label', () => {
  const message = {
    type: 'assistant',
    uuid: 'assistant-command',
    session_id: 'session-1',
    message: {
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: 'call-command',
          name: 'Bash',
          input: { command: 'bun test', description: 'Run the Feed tests' },
        },
      ],
    },
  } as unknown as SDKMessage
  expect(decodeClaudeLiveContent(message, () => {})).toMatchObject([
    {
      kind: 'tool',
      callId: 'call-command',
      presentation: { kind: 'command', label: 'Run the Feed tests', agentDescription: true },
    },
  ])
})

test('counts unsupported shapes and keeps unknown envelope markup out of content', () => {
  const rejected: string[] = []
  const history = {
    type: 'user',
    uuid: 'unknown-1',
    session_id: 'session-1',
    origin: { kind: 'task-notification' },
    message: { role: 'user', content: '<todo-list><item>one</item></todo-list>' },
  } as unknown as SessionMessage
  expect(decodeClaudeHistoryContent(history, (shape) => rejected.push(shape))).toEqual([
    {
      id: 'unknown-1',
      kind: 'diagnostic',
      vendorType: 'unknown-envelope',
      detail: 'Claude transcript envelope is not supported.',
    },
  ])
  const malformed = {
    type: 'assistant',
    uuid: 'malformed-1',
    session_id: 'session-1',
    message: { role: 'assistant', content: [{ type: 'future_block', value: 1 }] },
  } as unknown as SDKMessage
  expect(decodeClaudeLiveContent(malformed, (shape) => rejected.push(shape))).toEqual([])
  expect(rejected).toEqual(['unknown-envelope', 'message-block:future_block'])
})

test('preserves XML-shaped human prompts verbatim', () => {
  const rejected: string[] = []
  const message = {
    type: 'user',
    uuid: 'human-xml',
    message: { role: 'user', content: '<note>Hello</note>' },
  } as SessionMessage
  expect(decodeClaudeHistoryContent(message, (shape) => rejected.push(shape))).toEqual([
    { id: 'human-xml', kind: 'message', role: 'user', text: '<note>Hello</note>' },
  ])
  expect(rejected).toEqual([])
})

test('decodes Claude local shell output without exposing its tags', () => {
  const rejected: string[] = []
  const output = {
    type: 'user',
    uuid: 'shell-output',
    session_id: 'session-1',
    message: {
      role: 'user',
      content: '<bash-stdout>hello</bash-stdout><bash-stderr>warning</bash-stderr>',
    },
  } as SessionMessage
  expect(decodeClaudeHistoryContent(output, (shape) => rejected.push(shape))).toEqual([
    {
      id: 'shell-output',
      kind: 'command',
      command: null,
      cwd: null,
      status: 'completed',
      output: 'hello',
      stderr: 'warning',
      exitCode: null,
    },
  ])
  expect(rejected).toEqual([])
})

test('keeps Claude image and document sources structured', () => {
  const rejected: string[] = []
  const message = {
    type: 'user',
    uuid: 'media-1',
    session_id: 'session-1',
    message: {
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'aGVsbG8=' } },
        { type: 'document', source: { type: 'url', url: 'https://example.invalid/file.pdf' } },
      ],
    },
  } as SessionMessage
  expect(decodeClaudeHistoryContent(message, (shape) => rejected.push(shape))).toEqual([
    {
      id: 'media-1:0',
      kind: 'media',
      mediaType: 'image',
      role: 'user',
      source: { kind: 'data', mimeType: 'image/png', base64: 'aGVsbG8=' },
    },
    {
      id: 'media-1:1',
      kind: 'media',
      mediaType: 'document',
      role: 'user',
      source: { kind: 'url', url: 'https://example.invalid/file.pdf' },
    },
  ])
  expect(rejected).toEqual([])
})

function decodeSystemMessage(message: object, rejected: string[]) {
  return decodeClaudeLiveContent(message as SDKMessage, (shape) => rejected.push(shape))
}

test('decodes Claude system task updates under their task ID', () => {
  const rejected: string[] = []
  expect(
    decodeSystemMessage(
      {
        type: 'system',
        subtype: 'task_started',
        uuid: 'task-1',
        session_id: 'session-1',
        task_id: 'agent-1',
        tool_use_id: 'call-1',
        description: 'Review',
      },
      rejected,
    ),
  ).toEqual([
    {
      id: 'agent-1',
      kind: 'task',
      taskId: 'agent-1',
      callId: 'call-1',
      status: 'running',
      description: 'Review',
      summary: null,
    },
  ])
  expect(
    decodeSystemMessage(
      {
        type: 'system',
        subtype: 'task_progress',
        uuid: 'task-progress-2',
        session_id: 'session-1',
        task_id: 'agent-1',
        tool_use_id: 'call-1',
        description: 'Review',
        summary: 'Checking the Feed',
      },
      rejected,
    ),
  ).toMatchObject([{ id: 'agent-1', taskId: 'agent-1', summary: 'Checking the Feed' }])
  expect(rejected).toEqual([])
})

test('decodes Claude system notices and markers', () => {
  const rejected: string[] = []
  expect(
    decodeSystemMessage(
      {
        type: 'system',
        subtype: 'notification',
        uuid: 'notice-1',
        session_id: 'session-1',
        key: 'build',
        text: 'Build finished',
        priority: 'high',
      },
      rejected,
    ),
  ).toEqual([
    {
      id: 'notice-1',
      kind: 'notification',
      category: 'info',
      text: 'Build finished',
      priority: 'high',
    },
  ])
  expect(
    decodeSystemMessage(
      {
        type: 'system',
        subtype: 'compact_boundary',
        uuid: 'compact-1',
        session_id: 'session-1',
        compact_metadata: { trigger: 'auto', pre_tokens: 100 },
      },
      rejected,
    ),
  ).toEqual([{ id: 'compact-1', kind: 'marker', marker: 'compaction', summary: null }])
  expect(rejected).toEqual([])
})
