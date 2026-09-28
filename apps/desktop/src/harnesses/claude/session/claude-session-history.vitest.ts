import { readFileSync } from 'node:fs'
import { cp, mkdir } from 'node:fs/promises'
import path from 'node:path'
import type { SessionMessage } from '@anthropic-ai/claude-agent-sdk'
import { expect, test } from 'vitest'
import { claudeConfigDirFixture } from '../../../../test-fixtures/sessions/claude-config-dir.fixture'
import { decodeClaudeSessionMessages, readClaudeSessionHistory } from './claude-session-history'

const FIXTURES = new URL('../../../../mocks/cli/claude/fixtures/sessions/', import.meta.url)
const claudeConfigDir = claudeConfigDirFixture()

test('reads every prompt across two compaction boundaries', async () => {
  const projectDir = path.join(claudeConfigDir.dir, 'projects', 'project-one')
  await mkdir(projectDir, { recursive: true })
  await cp(
    new URL('parityMarkerCompacted.jsonl', FIXTURES),
    path.join(projectDir, 'session-under-test.jsonl'),
  )

  const content = await readClaudeSessionHistory('session-under-test', null)

  expect(content).toEqual([
    { kind: 'message', id: 'mc-p1', role: 'user', text: 'Start the work.' },
    { kind: 'message', id: 'msg-mc-a1', role: 'assistant', text: 'Starting.' },
    { id: 'mc-c1', kind: 'marker', marker: 'compaction', summary: null },
    { kind: 'message', id: 'mc-p2', role: 'user', text: 'Keep going.' },
    { kind: 'message', id: 'msg-mc-a2', role: 'assistant', text: 'Continuing.' },
    { id: 'mc-c2', kind: 'marker', marker: 'compaction', summary: null },
    { kind: 'message', id: 'mc-p3', role: 'user', text: 'Carry on.' },
    { kind: 'message', id: 'msg-mc-a3', role: 'assistant', text: 'Confirmed.' },
  ])
})

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
