import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readDelegations } from '../contract/signals'

function activity(status: 'running' | 'completed', timestamp: string) {
  return {
    kind: 'delegation' as const,
    uuid: `activity-${status}`,
    timestamp,
    actor: 'agent' as const,
    action: 'review_feed',
    status,
    progress: null,
    groupId: 'subagent-thread',
    callId: null,
  }
}

test('reads Codex subagent activity as a delegation that can open its transcript', () => {
  assert.deepEqual(
    readDelegations(
      [],
      [],
      [
        activity('running', '2026-09-16T16:38:00.000Z'),
        activity('completed', '2026-09-16T16:39:00.000Z'),
      ],
    ),
    [
      {
        id: 'subagent-thread',
        label: 'review_feed',
        landed: true,
        startedAt: '2026-09-16T16:38:00.000Z',
        endedAt: '2026-09-16T16:39:00.000Z',
      },
    ],
  )
})
