import assert from 'node:assert/strict'
import { test } from 'node:test'
import { projectFeed } from '@/core/sessions/feed-incremental'
import { transcriptFileFrom } from '@/core/sessions/transcript'
import { parseCodexTranscriptLine } from './records'

function subagentActivity(kind: string, agentThreadId: string, agentPath: string) {
  return parseCodexTranscriptLine(
    JSON.stringify({
      type: 'event_msg',
      timestamp: `2026-09-16T16:3${kind === 'started' ? '8' : '9'}:00.000Z`,
      payload: {
        type: 'item_completed',
        item: {
          type: 'SubAgentActivity',
          id: `subagent-${kind}`,
          kind,
          agent_thread_id: agentThreadId,
          agent_path: agentPath,
        },
      },
    }),
  )
}

test('reads Codex subagent activity as one Agent card entry', () => {
  assert.deepEqual(subagentActivity('started', 'thread-1', '/root/review_feed'), {
    kind: 'delegation',
    uuid: 'subagent-started',
    timestamp: '2026-09-16T16:38:00.000Z',
    actor: 'agent',
    action: 'Review feed',
    status: 'running',
    progress: null,
    groupId: 'thread-1',
    callId: null,
  })
  assert.deepEqual(subagentActivity('completed', 'thread-1', '/root/review_feed'), {
    kind: 'delegation',
    uuid: 'subagent-completed',
    timestamp: '2026-09-16T16:39:00.000Z',
    actor: 'agent',
    action: 'Review feed',
    status: 'completed',
    progress: null,
    groupId: 'thread-1',
    callId: null,
  })
})

function collaborationCall(name: string) {
  const record = parseCodexTranscriptLine(
    JSON.stringify({
      type: 'response_item',
      payload: {
        type: 'function_call',
        id: `${name}-item`,
        call_id: `${name}-call`,
        name,
        arguments: '{}',
      },
    }),
  )
  if (record === null) throw new Error('expected collaboration call')
  return record
}

test('hides Codex collaboration calls behind their Agent cards', () => {
  assert.deepEqual(collaborationCall('spawn_agent'), {
    kind: 'trace',
    uuid: 'spawn_agent-item',
    boundary: true,
  })
  for (const name of ['wait_agent', 'send_message', 'followup_task', 'list_agents']) {
    assert.deepEqual(collaborationCall(name), {
      kind: 'trace',
      uuid: `${name}-item`,
      boundary: true,
    })
  }
})

test('projects one Agent card without collaboration tool rows', () => {
  const started = subagentActivity('started', 'thread-1', '/root/review_feed')
  const completed = subagentActivity('completed', 'thread-1', '/root/review_feed')
  if (started === null || completed === null) throw new Error('expected subagent activity')
  const { rows } = projectFeed(
    {
      id: 'session-1',
      retiredIds: [],
      originUnread: false,
      files: [
        transcriptFileFrom('/tmp/session-1.jsonl', {
          fileName: 'session-1.jsonl',
          records: [
            collaborationCall('spawn_agent'),
            started,
            collaborationCall('wait_agent'),
            completed,
          ],
        }),
      ],
    },
    undefined,
  )
  assert.equal(rows.length, 1)
  const [row] = rows
  assert.equal(row?.shape, 'delegation-group')
  assert.equal(row?.actor, 'agent')
  assert.equal(row?.entries.length, 2)
})
