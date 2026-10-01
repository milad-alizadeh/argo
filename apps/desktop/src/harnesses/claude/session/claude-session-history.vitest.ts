import { readFileSync } from 'node:fs'
import type { SessionMessage } from '@anthropic-ai/claude-agent-sdk'
import { expect, test, vi } from 'vitest'
import { recordedSession } from '@/mocks/cli/claude/recorded-claude-sessions'
import { RECORDED_PROMPTS } from '@/mocks/cli/recorded-prompts'
import { decodeClaudeSessionMessages } from './claude-session-history'

function recordedMessages(name: string): SessionMessage[] {
  const recorded = readFileSync(
    new URL(`../../../../mocks/cli/claude/fixtures/sessions/${name}.jsonl`, import.meta.url),
    'utf8',
  )
  return recorded
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as SessionMessage)
    .filter((entry) => entry.type === 'user' || entry.type === 'assistant')
}

// The decoded reply is text the recording's last assistant message holds, whatever a re-record says.
function expectRecordedReply(messages: SessionMessage[], text: unknown) {
  expect(text).toEqual(expect.stringMatching(/\S/))
  const reply = messages.findLast((entry) => entry.type === 'assistant')
  expect(JSON.stringify(reply?.message)).toContain(JSON.stringify(text).slice(1, -1))
}

test('decodes a real Claude Session the Agent SDK read back', () => {
  const prose = recordedSession(RECORDED_PROMPTS.claudeProse)
  const decoded = decodeClaudeSessionMessages(prose)
  expect(decoded).toEqual([
    { kind: 'message', id: expect.any(String), role: 'user', text: RECORDED_PROMPTS.claudeProse },
    { kind: 'message', id: expect.any(String), role: 'assistant', text: expect.any(String) },
  ])
  expectRecordedReply(prose, decoded[1]?.kind === 'message' && decoded[1].text)
})

// Claude CLI writes a thought with its signature and no text, which has nothing to show.
test('drops a real Claude thought that carries no text', () => {
  const thought = recordedSession(RECORDED_PROMPTS.claudeThought)
  const decoded = decodeClaudeSessionMessages(thought)
  expect(decoded).toEqual([
    expect.objectContaining({ kind: 'message', role: 'user' }),
    expect.objectContaining({ kind: 'message', role: 'assistant' }),
  ])
  expectRecordedReply(thought, decoded[1]?.kind === 'message' && decoded[1].text)
})

test('reads an Agent call as a start that its task notification answers', () => {
  expect(decodeClaudeSessionMessages(recordedMessages('delegationHistory'))).toEqual([
    {
      kind: 'message',
      id: 'dh-p',
      role: 'user',
      text: 'Survey the adapters, then fix the bug.',
    },
    {
      kind: 'delegation',
      id: 'toolu_dh_agent',
      event: 'started',
      agentId: 'a0d1e2f3a4b5c6d7e',
      status: 'running',
      name: 'Survey the Harness adapters',
      prompt: "Report each Harness adapter's process ownership, with file paths.",
      model: null,
      summary: null,
    },
    {
      kind: 'reference',
      id: 'msg_dh_2',
      referenceType: 'skill',
      label: 'diagnosing-bugs',
      target: null,
      text: 'The Session keeps showing Running',
    },
    {
      kind: 'delegation',
      id: 'toolu_dh_agent:response',
      event: 'responded',
      agentId: 'a0d1e2f3a4b5c6d7e',
      status: 'completed',
      name: 'Survey the Harness adapters',
      prompt: null,
      model: null,
      summary: 'Agent "Survey the Harness adapters" finished',
    },
  ])
})

test('draws a skill as a row that names it, and a skill slash command as the command it ran', () => {
  const skills = decodeClaudeSessionMessages([
    ...recordedMessages('delegationHistory'),
    ...recordedMessages('harnessNoise'),
  ]).filter((content) => content.kind === 'reference' || content.kind === 'command')

  expect(skills).toEqual([
    expect.objectContaining({ referenceType: 'skill', label: 'diagnosing-bugs', target: null }),
    expect.objectContaining({ kind: 'command', command: '/effort' }),
    expect.objectContaining({ kind: 'command', output: 'Set effort level to medium' }),
    expect.objectContaining({ id: 'u-implement', kind: 'command' }),
  ])
})

test('reads a recorded Edit and Write as settled file changes carrying their diffs', () => {
  const edits = decodeClaudeSessionMessages(recordedMessages('recordedEdit')).filter(
    (content) => content.kind !== 'message',
  )
  expect(edits).toMatchObject([
    {
      kind: 'fileChange',
      id: 'toolu_01QcoWSLSMjQ9e4NFtQ5Aq7F',
      status: 'running',
      changes: [
        {
          path: '/Users/x/argo/apps/desktop/src/domains/sessions/api/feed/tool-groups.ts',
          change: 'update',
        },
      ],
    },
    { kind: 'fileChange', id: 'toolu_01QcoWSLSMjQ9e4NFtQ5Aq7F', status: 'completed' },
    {
      kind: 'fileChange',
      id: 'toolu_015ibQYLNWgCPTmJHFnse358',
      status: 'running',
      changes: [
        {
          path: '/Users/x/argo/apps/desktop/src/domains/sessions/renderer/feed/content/feed-inline-markdown.tsx',
          change: 'add',
          diff: expect.stringContaining('export const FeedInlineMarkdown'),
        },
      ],
    },
    { kind: 'fileChange', id: 'toolu_015ibQYLNWgCPTmJHFnse358', status: 'completed' },
  ])
})

const envelopeCorpus = readFileSync(
  new URL(
    '../../../../mocks/cli/claude/fixtures/session-history-envelope-corpus.jsonl',
    import.meta.url,
  ),
  'utf8',
)
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line) as SessionMessage)

// Decodes records and returns the warning that counts what was rejected, if any.
function decodeWithWarnings(records: readonly object[]) {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    const content = decodeClaudeSessionMessages(records as SessionMessage[])
    return { content, warnings: warn.mock.calls.map(([message]) => message) }
  } finally {
    warn.mockRestore()
  }
}

const userRecord = (uuid: string, content: unknown, extra: object = {}) => ({
  type: 'user',
  uuid,
  message: { role: 'user', content },
  ...extra,
})

test('names an assistant reply by its API message id', () => {
  const message = {
    role: 'assistant',
    id: 'msg-api-1',
    content: [{ type: 'text', text: 'Argo live feed verified.' }],
  }
  expect(decodeWithWarnings([{ type: 'assistant', uuid: 'envelope-1', message }])).toEqual({
    content: [
      { id: 'msg-api-1', kind: 'message', role: 'assistant', text: 'Argo live feed verified.' },
    ],
    warnings: [],
  })
})

test('reads a compaction summary as a marker', () => {
  const summary = userRecord('compact-summary-1', 'The summary begins here.', {
    isCompactSummary: true,
  })
  expect(decodeWithWarnings([summary])).toEqual({
    content: [{ id: 'compact-summary-1', kind: 'marker', marker: 'compaction', summary: null }],
    warnings: [],
  })
})

test('reads a tool result and skips its tool_reference metadata without a rejection', () => {
  const result = userRecord('result-1', [
    {
      type: 'tool_result',
      tool_use_id: 'call-1',
      content: [
        { type: 'text', text: 'Done.' },
        { type: 'tool_reference', tool_name: 'Bash' },
      ],
    },
  ])
  const { content, warnings } = decodeWithWarnings([result])
  expect(content).toMatchObject([
    { kind: 'tool', callId: 'call-1', output: [{ kind: 'text', text: 'Done.' }] },
  ])
  expect(warnings).toEqual([])
})

test('reads recorded command, task, and delegation shapes', () => {
  const { content, warnings } = decodeWithWarnings(recordedMessages('harnessNoise'))
  expect(content).toContainEqual(
    expect.objectContaining({ id: 'u-effort', kind: 'command', command: '/effort' }),
  )
  expect(content).toContainEqual(
    expect.objectContaining({ id: 'u-delegation', kind: 'delegation', agentId: 'feed-review' }),
  )
  expect(content).toContainEqual(
    expect.objectContaining({ id: 'u-shell-start', kind: 'task', taskId: 'build' }),
  )
  expect(content).toContainEqual({
    id: 'u-quoted',
    kind: 'message',
    role: 'user',
    text: 'Quote <local-command-caveat>this markup</local-command-caveat> exactly.',
  })
  expect(warnings).toEqual([])
})

test('reads recorded command and task envelopes before they reach the Feed', () => {
  expect(decodeWithWarnings(envelopeCorpus)).toEqual({
    content: [
      {
        id: 'recorded-skill-invocation',
        kind: 'command',
        command: '/to-spec https://example.invalid/issues/1',
        status: 'completed',
        output: null,
        stderr: null,
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
    ],
    warnings: [],
  })
})

test('keeps a human prompt that looks like markup verbatim', () => {
  const human = userRecord('human-1', '<system-reminder>Hello</system-reminder>', {
    origin: { kind: 'human' },
  })
  const plain = userRecord('human-2', '<note>Hello</note>')
  expect(decodeWithWarnings([human, plain]).content).toEqual([
    {
      id: 'human-1',
      kind: 'message',
      role: 'user',
      text: '<system-reminder>Hello</system-reminder>',
    },
    { id: 'human-2', kind: 'message', role: 'user', text: '<note>Hello</note>' },
  ])
})

test('keeps block identity, the tool call, and its result apart', () => {
  const assistant = {
    type: 'assistant',
    uuid: 'assistant-1',
    message: {
      role: 'assistant',
      content: [
        { type: 'thinking', thinking: 'First check the file.' },
        { type: 'text', text: 'I will inspect it.' },
        { type: 'tool_use', id: 'call-1', name: 'Read', input: { file_path: '/tmp/a' } },
      ],
    },
  }
  const result = userRecord('result-1', [
    { type: 'tool_result', tool_use_id: 'call-1', content: [{ type: 'text', text: 'file body' }] },
  ])
  expect(decodeWithWarnings([assistant, result]).content).toMatchObject([
    { id: 'assistant-1:0', kind: 'reasoning', text: 'First check the file.' },
    { id: 'assistant-1:1', kind: 'message', role: 'assistant', text: 'I will inspect it.' },
    {
      id: 'assistant-1:2',
      kind: 'tool',
      callId: 'call-1',
      name: 'Read',
      status: 'running',
      presentation: { kind: 'read', label: 'Read /tmp/a' },
    },
    { id: 'result-1', kind: 'tool', callId: 'call-1', status: 'completed' },
  ])
})

test('labels a command by its Claude Code description and keeps the command text', () => {
  const assistant = {
    type: 'assistant',
    uuid: 'assistant-command',
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
  }
  expect(decodeWithWarnings([assistant]).content).toMatchObject([
    {
      kind: 'tool',
      callId: 'call-command',
      presentation: {
        kind: 'command',
        label: 'Run the Feed tests',
        agentDescription: true,
        text: 'bun test',
      },
    },
  ])
})

test('counts unsupported shapes and keeps unknown envelope markup out of the Feed', () => {
  const envelope = userRecord('unknown-1', '<todo-list><item>one</item></todo-list>', {
    origin: { kind: 'task-notification' },
  })
  const future = {
    type: 'assistant',
    uuid: 'future-1',
    message: { role: 'assistant', content: [{ type: 'future_block', value: 1 }] },
  }
  expect(decodeWithWarnings([envelope, future])).toEqual({
    content: [
      {
        id: 'unknown-1',
        kind: 'diagnostic',
        vendorType: 'unknown-envelope',
        detail: 'Claude transcript envelope is not supported.',
      },
      {
        id: 'future-1',
        kind: 'diagnostic',
        vendorType: 'message-block:future_block',
        detail: 'Unsupported Claude output.',
      },
    ],
    warnings: ['Rejected 2 unsupported Claude history shape(s).'],
  })
})

test('reads local shell output without its tags', () => {
  const output = userRecord(
    'shell-output',
    '<bash-stdout>hello</bash-stdout><bash-stderr>warning</bash-stderr>',
  )
  expect(decodeWithWarnings([output]).content).toEqual([
    {
      id: 'shell-output',
      kind: 'command',
      command: null,
      status: 'completed',
      output: 'hello',
      stderr: 'warning',
    },
  ])
})

test('folds an image into the prompt row and leaves a linked document standalone', () => {
  const message = userRecord('media-1', [
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'aGVsbG8=' } },
    { type: 'document', source: { type: 'url', url: 'https://example.invalid/file.pdf' } },
  ])
  expect(decodeWithWarnings([message]).content).toEqual([
    {
      id: 'media-1',
      kind: 'message',
      role: 'user',
      text: '',
      images: [{ kind: 'data', mimeType: 'image/png', base64: 'aGVsbG8=' }],
    },
    {
      id: 'media-1:1',
      kind: 'media',
      mediaType: 'document',
      role: 'user',
      source: { kind: 'url', url: 'https://example.invalid/file.pdf' },
    },
  ])
})

test('folds an image and pasted text into the prompt row beside its text', () => {
  const message = userRecord('media-2', [
    { type: 'text', text: 'See attached.' },
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'aGVsbG8=' } },
    { type: 'document', source: { type: 'text', data: 'Pasted body' } },
  ])
  expect(decodeWithWarnings([message]).content).toEqual([
    {
      id: 'media-2:0',
      kind: 'message',
      role: 'user',
      text: 'See attached.',
      images: [{ kind: 'data', mimeType: 'image/png', base64: 'aGVsbG8=' }],
      pastedContent: [{ id: 'media-2:2', text: 'Pasted body' }],
    },
  ])
})
