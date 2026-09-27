import { readFileSync } from 'node:fs'
import type { SessionMessage } from '@anthropic-ai/claude-agent-sdk'
import { expect, test } from 'vitest'
import { decodeClaudeSessionMessages } from './claude-session-history'

test('decodes Claude user and assistant content without system messages', () => {
  const recorded = readFileSync(
    new URL('../../../../mocks/cli/claude/fixtures/sessions/parityProse.jsonl', import.meta.url),
    'utf8',
  )
  const messages = recorded
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as SessionMessage)
    .filter((entry) => entry.type === 'user' || entry.type === 'assistant')

  expect(decodeClaudeSessionMessages(messages)).toEqual([
    { kind: 'message', id: 'pr-p', role: 'user', text: 'Say hello, then confirm.' },
    { kind: 'message', id: 'pr-a', role: 'assistant', text: 'Hello there. Confirmed.' },
  ])
})
