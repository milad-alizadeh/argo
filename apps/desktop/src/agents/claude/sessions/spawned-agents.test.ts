import assert from 'node:assert/strict'
import { test } from 'node:test'
import { transcriptFileFrom } from '@/domains/sessions/contract/model/transcript'
import { readSubagents } from '@/domains/sessions/contract/observation/signals'
import { projectFeed } from '@/domains/sessions/main/projection/feed-incremental'
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
  const file = transcriptFileFrom('/x/s.jsonl', { sessionId: 's', records: records(...lines) })
  return projectFeed({ id: 's', retiredIds: [], files: [file], originUnread: false }, undefined)
    .rows
}

const MESSAGE = {
  type: 'assistant',
  uuid: 'a-2',
  timestamp: '2026-09-18T10:01:00.000Z',
  message: {
    role: 'assistant',
    content: [
      {
        type: 'tool_use',
        id: 'toolu_2',
        name: 'SendMessage',
        input: { to: 'toolu_1', message: 'Also check focus.' },
      },
    ],
  },
}

const launched = answer('Async agent launched.', { isAsync: true, agentId: 'agent-9' })

test('draws a spawned Subagent as a started row and never as a tool row', () => {
  const rows = rowsOf(SPAWN, launched)
  assert.deepEqual(
    rows.map((row) => row.shape),
    ['prose', 'subagent'],
  )
  const row = rows[1]
  assert.equal(row?.shape === 'subagent' && row.event, 'started')
  assert.equal(row?.shape === 'subagent' && row.name, 'Review the Feed card')
})

test('draws one row for each event of a Subagent messaged and answered in the foreground', () => {
  const rows = rowsOf(SPAWN, MESSAGE, answer('Eleven callers.\nSecond line.'))
  assert.deepEqual(
    rows.flatMap((row) => (row.shape === 'subagent' ? [row.event] : [])),
    ['started', 'messaged', 'responded'],
  )
  const responded = rows.find((row) => row.shape === 'subagent' && row.event === 'responded')
  assert.equal(responded?.shape === 'subagent' && responded.text, 'Eleven callers.')
  assert.equal(responded?.shape === 'subagent' && responded.state, 'completed')
})

test('lands a Subagent the CLI answered in the foreground at its answer', () => {
  assert.deepEqual(readSubagents(records(SPAWN, answer('Eleven callers.'))), [
    {
      id: 'toolu_1',
      label: 'Review the Feed card',
      state: 'completed',
      startedAt: '2026-09-18T10:00:00.000Z',
      endedAt: '2026-09-18T10:00:05.000Z',
    },
  ])
})

test('keeps a backgrounded Subagent running until its notification responds for it', () => {
  assert.equal(readSubagents(records(SPAWN, launched))[0]?.state, 'running')
  const rows = rowsOf(SPAWN, launched, NOTIFICATION)
  assert.deepEqual(
    rows.flatMap((row) => (row.shape === 'subagent' ? [`${row.subagentId}:${row.event}`] : [])),
    ['toolu_1:started', 'toolu_1:responded'],
  )
  assert.deepEqual(readSubagents(records(SPAWN, launched, NOTIFICATION)), [
    {
      id: 'toolu_1',
      label: 'Review the Feed card',
      state: 'completed',
      startedAt: '2026-09-18T10:00:00.000Z',
      endedAt: '2026-09-18T10:03:00.000Z',
    },
  ])
})

test('ends a Subagent as interrupted on a stop call and draws no row for the call', () => {
  const stop = {
    type: 'assistant',
    uuid: 'a-3',
    timestamp: '2026-09-18T10:02:00.000Z',
    message: {
      role: 'assistant',
      content: [
        { type: 'tool_use', id: 'toolu_3', name: 'TaskStop', input: { task_id: 'agent-9' } },
      ],
    },
  }
  const lines = [SPAWN, launched, stop]
  assert.equal(readSubagents(records(...lines))[0]?.state, 'interrupted')
  assert.deepEqual(
    rowsOf(...lines).map((row) => row.shape),
    ['prose', 'subagent', 'subagent'],
  )
})
