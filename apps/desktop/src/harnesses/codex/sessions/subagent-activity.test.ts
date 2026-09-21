import assert from 'node:assert/strict'
import { test } from 'node:test'
import { transcriptFileFrom } from '@/domains/sessions/contract/model/transcript'
import { projectFeed } from '@/domains/sessions/main/projection/feed-incremental'
import { normalizeCodexMessageRecords } from '@/harnesses/codex/sessions/discover'
import { parseCodexTranscriptLine } from '@/harnesses/codex/sessions/records'

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
  const events = ['started', 'interacted', 'completed', 'interrupted'].map((kind) =>
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
      ['thread-1', 'responded', 'Review feed'],
    ],
  )
  assert.equal(
    events[2]?.kind === 'subagent' && events[2].event === 'responded' && events[2].state,
    'completed',
  )
  assert.equal(
    events[3]?.kind === 'subagent' && events[3].event === 'responded' && events[3].state,
    'interrupted',
  )
})

function collaborationCall(name: string, input: Record<string, unknown> = {}) {
  const record = parseCodexTranscriptLine(
    JSON.stringify({
      type: 'response_item',
      payload: {
        type: 'function_call',
        id: `${name}-item`,
        call_id: `${name}-call`,
        name,
        arguments: JSON.stringify(input),
      },
    }),
  )
  if (record === null) throw new Error('expected collaboration call')
  return record
}

test('uses the native interrupted activity instead of synthesizing a duplicate', () => {
  const started = subagentActivity('started', 'thread-1', '/root/review_feed')
  const interrupted = subagentActivity('interrupted', 'thread-1', '/root/review_feed')
  if (started === null || interrupted === null) throw new Error('expected subagent activity')
  const records = normalizeCodexMessageRecords([
    started,
    collaborationCall('interrupt_agent', { target: '/root/review_feed' }),
    interrupted,
  ])
  assert.deepEqual(
    records.flatMap((record) =>
      record.kind === 'subagent' && record.event === 'responded' ? [record.state] : [],
    ),
    ['interrupted'],
  )
})

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
