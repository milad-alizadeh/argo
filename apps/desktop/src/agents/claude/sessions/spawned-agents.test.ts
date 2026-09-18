import assert from 'node:assert/strict'
import { test } from 'node:test'
import { projectFeed } from '@/core/sessions/feed-incremental'
import { readDelegations } from '@/core/sessions/signals'
import { transcriptFileFrom } from '@/core/sessions/transcript'
import { parseTranscriptLine } from './records'
import { readingSpawnedAgents } from './spawned-agents'

const SPAWN = {
  type: 'assistant',
  uuid: 'a-1',
  timestamp: '2026-09-18T10:00:00.000Z',
  message: {
    role: 'assistant',
    content: [
      { type: 'text', text: 'Sending a reviewer.' },
      {
        type: 'tool_use',
        id: 'toolu_1',
        name: 'Agent',
        input: { description: 'Review the Feed card', prompt: 'Review it.', model: 'sonnet' },
      },
    ],
  },
}

function answer(content: string, toolUseResult?: Record<string, unknown>) {
  return {
    type: 'user',
    uuid: 'u-1',
    timestamp: '2026-09-18T10:00:05.000Z',
    message: {
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content }],
    },
    ...(toolUseResult === undefined ? {} : { toolUseResult }),
  }
}

const NOTIFICATION = {
  type: 'user',
  uuid: 'u-2',
  timestamp: '2026-09-18T10:03:00.000Z',
  message: {
    role: 'user',
    content:
      '<task-notification>\n<task-id>agent-9</task-id>\n<tool-use-id>toolu_1</tool-use-id>\n<status>completed</status>\n<summary>Agent "Review the Feed card" finished</summary>\n<result>Looks right.</result>\n</task-notification>',
  },
}

function records(...lines: Record<string, unknown>[]) {
  return readingSpawnedAgents(
    lines.flatMap((line) => parseTranscriptLine(JSON.stringify(line)) ?? []),
  )
}

function rowsOf(...lines: Record<string, unknown>[]) {
  const file = transcriptFileFrom('/x/s.jsonl', { fileName: 's.jsonl', records: records(...lines) })
  return projectFeed({ id: 's', retiredIds: [], files: [file], originUnread: false }, undefined)
    .rows
}

test('draws a spawned Subagent as one Thread card and never as a tool row', () => {
  const rows = rowsOf(SPAWN, answer('Async agent launched.', { isAsync: true, agentId: 'agent-9' }))
  assert.deepEqual(
    rows.map((row) => row.shape),
    ['prose', 'delegation-group'],
  )
  const card = rows[1]
  assert.equal(card?.shape === 'delegation-group' && card.groupId, 'toolu_1')
})

test('lands a Subagent the CLI answered in the foreground at its answer', () => {
  assert.deepEqual(readDelegations(records(SPAWN, answer('Eleven callers.'))), [
    {
      id: 'toolu_1',
      label: 'Review the Feed card',
      landed: true,
      startedAt: '2026-09-18T10:00:00.000Z',
      endedAt: '2026-09-18T10:00:05.000Z',
    },
  ])
})

test('keeps a backgrounded Subagent running until its notification joins the same card', () => {
  const launched = answer('Async agent launched.', { isAsync: true, agentId: 'agent-9' })
  assert.equal(readDelegations(records(SPAWN, launched))[0]?.landed, false)
  const rows = rowsOf(SPAWN, launched, NOTIFICATION)
  assert.equal(rows.filter((row) => row.shape === 'delegation-group').length, 1)
  assert.deepEqual(readDelegations(records(SPAWN, launched, NOTIFICATION)), [
    {
      id: 'toolu_1',
      label: 'Review the Feed card',
      landed: true,
      startedAt: '2026-09-18T10:00:00.000Z',
      endedAt: '2026-09-18T10:03:00.000Z',
    },
  ])
})
