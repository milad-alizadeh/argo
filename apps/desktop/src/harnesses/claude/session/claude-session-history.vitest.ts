import { readFileSync } from 'node:fs'
import type { SessionMessage } from '@anthropic-ai/claude-agent-sdk'
import { expect, test } from 'vitest'
import { projectClaudeSessionMessages } from './claude-session-history'

test('projects Claude user and assistant message text without system or tool content', () => {
  const recorded = readFileSync(
    new URL('../../../../mocks/cli/claude/fixtures/sessions/parityProse.jsonl', import.meta.url),
    'utf8',
  )
  const messages = recorded
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as SessionMessage)
    .filter((entry) => entry.type === 'user' || entry.type === 'assistant')

  expect(projectClaudeSessionMessages(messages)).toEqual([
    { shape: 'prose', id: 'pr-p', role: 'user', text: 'Say hello, then confirm.' },
    { shape: 'prose', id: 'pr-a', role: 'assistant', text: 'Hello there. Confirmed.' },
  ])
})
