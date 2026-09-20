import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseCodexTranscriptLine } from '@/agents/codex/sessions/records'
import { transcriptFileFrom } from '@/domains/sessions/contract/model/transcript'
import { projectFeed } from '@/domains/sessions/main/projection/feed-incremental'

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

test('reads each Codex subagent activity as one lifecycle event', () => {
  const events = ['started', 'interacted', 'completed'].map((kind) =>
    subagentActivity(kind, 'thread-1', '/root/review_feed'),
  )
  assert.deepEqual(
    events.map(
      (event) => event?.kind === 'subagent' && [event.subagentId, event.event, event.name],
    ),
    [
      ['thread-1', 'started', 'Review feed'],
      ['thread-1', 'messaged', 'Review feed'],
      ['thread-1', 'responded', 'Review feed'],
    ],
  )
  assert.equal(
    events[2]?.kind === 'subagent' && events[2].event === 'responded' && events[2].state,
    'completed',
  )
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

test('hides Codex collaboration calls behind the events they read as', () => {
  for (const name of ['wait_agent', 'send_message', 'followup_task', 'list_agents']) {
    assert.deepEqual(collaborationCall(name), {
      kind: 'trace',
      uuid: `${name}-item`,
      boundary: true,
    })
  }
  assert.equal(collaborationCall('spawn_agent').kind, 'trace')
  assert.equal(collaborationCall('interrupt_agent').kind, 'trace')
})

test('projects one row per event without collaboration tool rows', () => {
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
          sessionId: 'session-1',
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
  assert.deepEqual(
    rows.map((row) => (row.shape === 'subagent' ? row.event : row.shape)),
    ['started', 'responded'],
  )
})
