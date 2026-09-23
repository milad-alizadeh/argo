import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readSubagents } from '@/domains/sessions/contract/observation/signals'
import { parseTranscriptLine } from '../../transcript'
import { readingSpawnedAgents } from './spawned-agents'

const SPAWN = {
  type: 'assistant',
  uuid: 'a-1',
  timestamp: '2026-09-18T10:00:00.000Z',
  message: {
    role: 'assistant',
    content: [
      {
        type: 'tool_use',
        id: 'toolu_1',
        name: 'Agent',
        input: { description: 'Review the Feed card', prompt: 'Review it.', model: 'sonnet' },
      },
    ],
  },
}

const LAUNCHED = {
  type: 'user',
  uuid: 'u-1',
  timestamp: '2026-09-18T10:00:05.000Z',
  message: {
    role: 'user',
    content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: '' }],
  },
  toolUseResult: { isAsync: true, agentId: 'agent-9' },
}

const MESSAGE_NOTIFICATION = {
  type: 'user',
  uuid: 'notification-1',
  timestamp: '2026-09-18T10:03:00.000Z',
  message: {
    role: 'user',
    content:
      '<task-notification>\n<task-id>agent-9</task-id>\n<tool-use-id>toolu_1</tool-use-id>\n<status>completed</status>\n<summary>Agent "Review the Feed card" finished</summary>\n</task-notification>',
  },
}

function records(...lines: Record<string, unknown>[]) {
  return readingSpawnedAgents(
    lines.flatMap((line) => parseTranscriptLine(JSON.stringify(line)) ?? []),
  )
}

function attachmentNotification(status: 'completed' | 'failed' | 'killed' | 'stopped') {
  return {
    type: 'attachment',
    uuid: `attachment-${status}`,
    timestamp: '2026-09-18T10:03:00.000Z',
    attachment: {
      commandMode: 'task-notification',
      prompt: `<task-notification>\n<task-id>agent-9</task-id>\n<tool-use-id>toolu_1</tool-use-id>\n<status>${status}</status>\n<summary>Agent "Review the Feed card" finished</summary>\n</task-notification>`,
    },
  }
}

test('ends a backgrounded Subagent from Claude task-notification attachment', () => {
  for (const [status, state] of [
    ['completed', 'completed'],
    ['failed', 'failed'],
    ['killed', 'interrupted'],
    ['stopped', 'interrupted'],
  ] as const) {
    assert.deepEqual(readSubagents(records(SPAWN, LAUNCHED, attachmentNotification(status))), [
      {
        id: 'toolu_1',
        label: 'Review the Feed card',
        state,
        startedAt: '2026-09-18T10:00:00.000Z',
        endedAt: '2026-09-18T10:03:00.000Z',
      },
    ])
  }
})

test('keeps a background command attachment as a background task', () => {
  const command = {
    type: 'assistant',
    uuid: 'command-1',
    timestamp: '2026-09-18T10:00:00.000Z',
    message: {
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: 'toolu_command',
          name: 'Bash',
          input: { command: 'bun run test', run_in_background: true },
        },
      ],
    },
  }
  const attachment = {
    ...attachmentNotification('completed'),
    attachment: {
      commandMode: 'task-notification',
      prompt:
        '<task-notification>\n<task-id>command-9</task-id>\n<tool-use-id>toolu_command</tool-use-id>\n<status>completed</status>\n<summary>Background command "Run tests" completed</summary>\n</task-notification>',
    },
  }
  assert.equal(records(command, attachment)[1]?.kind, 'background-task')
})

test('keeps one Subagent response when Claude writes both notification records', () => {
  for (const recordsInOrder of [
    [SPAWN, LAUNCHED, MESSAGE_NOTIFICATION, attachmentNotification('completed')],
    [SPAWN, LAUNCHED, attachmentNotification('completed'), MESSAGE_NOTIFICATION],
  ]) {
    assert.deepEqual(
      records(...recordsInOrder)
        .filter((record) => record.kind === 'subagent')
        .map((record) => record.event),
      ['started', 'responded'],
    )
  }
})
