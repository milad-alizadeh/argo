import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readDelegations } from './signals'
import type { TranscriptRecord } from './transcript'

type Delegation = Extract<TranscriptRecord, { kind: 'delegation' }>

function activity(
  status: string | null,
  timestamp: string | null,
  overrides: Partial<Delegation> = {},
): Delegation {
  return {
    kind: 'delegation',
    uuid: `activity-${status}`,
    timestamp,
    actor: 'agent',
    action: 'review_feed',
    status,
    progress: null,
    groupId: 'subagent-thread',
    callId: null,
    ...overrides,
  }
}

test('reads a Subagent that opened and landed as one delegation with both times', () => {
  assert.deepEqual(
    readDelegations([
      activity('running', '2026-09-16T16:38:00.000Z'),
      activity('completed', '2026-09-16T16:39:00.000Z'),
    ]),
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

test('keeps the opening label when the landing record names none', () => {
  const [delegation] = readDelegations([
    activity('running', '2026-09-16T16:38:00.000Z'),
    activity('completed', '2026-09-16T16:39:00.000Z', { action: null }),
  ])
  assert.equal(delegation?.label, 'review_feed')
})

test('reads a Subagent whose only record has no status as still running', () => {
  assert.equal(readDelegations([activity(null, null)])[0]?.landed, false)
})

test('reads a shell task and an agent record with no group as no delegation', () => {
  assert.deepEqual(
    readDelegations([
      activity('completed', null, { actor: 'shell' }),
      activity('completed', null, { groupId: null }),
    ]),
    [],
  )
})
