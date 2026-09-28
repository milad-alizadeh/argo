import { readFileSync } from 'node:fs'
import type { SessionMessage } from '@anthropic-ai/claude-agent-sdk'
import { expect, test } from 'vitest'
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

test('decodes Claude user and assistant content without system messages', () => {
  expect(decodeClaudeSessionMessages(recordedMessages('parityProse'))).toEqual([
    { kind: 'message', id: 'pr-p', role: 'user', text: 'Say hello, then confirm.' },
    { kind: 'message', id: 'pr-a', role: 'assistant', text: 'Hello there. Confirmed.' },
  ])
})

test('reads an Agent call as one delegation that its task notification completes', () => {
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
      id: 'toolu_dh_agent',
      agentId: 'a0d1e2f3a4b5c6d7e',
      status: 'completed',
      name: 'Survey the Harness adapters',
      prompt: "Report each Harness adapter's process ownership, with file paths.",
      model: null,
      summary: 'Agent "Survey the Harness adapters" finished',
    },
  ])
})

test('gives a skill its SKILL.md and draws a skill slash command as a skill', () => {
  const files: Record<string, string> = {
    'diagnosing-bugs': '/repo/.claude/skills/diagnosing-bugs/SKILL.md',
    implement: '/repo/.claude/skills/implement/SKILL.md',
  }
  const skillFile = (name: string) => files[name] ?? null
  const skills = decodeClaudeSessionMessages(
    [...recordedMessages('delegationHistory'), ...recordedMessages('harnessNoise')],
    skillFile,
  ).filter((content) => content.kind === 'reference' || content.kind === 'command')

  expect(skills).toEqual([
    expect.objectContaining({
      referenceType: 'skill',
      label: 'diagnosing-bugs',
      target: '/repo/.claude/skills/diagnosing-bugs/SKILL.md',
    }),
    expect.objectContaining({ kind: 'command', command: '/effort' }),
    expect.objectContaining({ kind: 'command', output: 'Set effort level to medium' }),
    {
      kind: 'reference',
      id: 'u-implement',
      referenceType: 'skill',
      label: 'implement',
      target: '/repo/.claude/skills/implement/SKILL.md',
      text: '318 open storybook while you do it',
    },
  ])
})
