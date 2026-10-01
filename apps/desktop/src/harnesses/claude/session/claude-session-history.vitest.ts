import { readFileSync } from 'node:fs'
import type { SessionMessage } from '@anthropic-ai/claude-agent-sdk'
import { expect, test } from 'vitest'
import { recordedSession } from '@/mocks/cli/claude/recorded-claude-sessions'
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

test('decodes a real Claude Session the Agent SDK read back', () => {
  expect(decodeClaudeSessionMessages(recordedSession('Say hello, then confirm.'))).toEqual([
    {
      kind: 'message',
      id: '64e0ef8d-2563-4053-83c7-4354aa5f54f6',
      role: 'user',
      text: 'Say hello, then confirm.',
    },
    {
      kind: 'message',
      id: 'msg_011CfaqRRGWufqb3CsUuQkjm',
      role: 'assistant',
      text: "Hello! Confirmed. I'm up and running in `/Users/x/prose` and ready to help.",
    },
  ])
})

// Claude CLI 2.1.286 writes a thought with its signature and no text.
test('decodes a real Claude thought as reasoning before the reply', () => {
  const thought = recordedSession(
    'Ultrathink: is 221 prime? Reason before answering, then answer in one sentence.',
  )
  expect(decodeClaudeSessionMessages(thought)).toEqual([
    expect.objectContaining({ kind: 'message', role: 'user' }),
    { kind: 'reasoning', id: 'msg_011CfaqV3LX1rAfBRRTgAgWZ', text: '', redacted: false },
    {
      kind: 'message',
      id: 'msg_011CfaqV3LX1rAfBRRTgAgWZ',
      role: 'assistant',
      text: 'No, 221 is not prime, because 221 = 13 × 17.',
    },
  ])
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
