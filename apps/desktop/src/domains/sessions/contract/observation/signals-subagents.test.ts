import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { SubagentEvent } from '../model/transcript/subagent-event'
import { readSubagents } from './signals'

function event(
  name: 'started' | 'messaged' | 'responded',
  timestamp: string | null,
  extra: {
    subagentId?: string
    label?: string
    state?: 'completed' | 'failed' | 'interrupted'
  } = {},
): SubagentEvent {
  const base = {
    kind: 'subagent' as const,
    uuid: `subagent-${name}`,
    timestamp,
    subagentId: extra.subagentId ?? 'subagent-thread',
    ...(extra.label === undefined ? {} : { name: extra.label }),
  }
  return name === 'responded'
    ? { ...base, event: name, state: extra.state ?? 'completed' }
    : { ...base, event: name }
}

test('folds a Subagent that started and responded into one row with both times', () => {
  assert.deepEqual(
    readSubagents([
      event('started', '2026-09-16T16:38:00.000Z', { label: 'review_feed' }),
      event('responded', '2026-09-16T16:39:00.000Z'),
    ]),
    [
      {
        id: 'subagent-thread',
        label: 'review_feed',
        state: 'completed',
        startedAt: '2026-09-16T16:38:00.000Z',
        endedAt: '2026-09-16T16:39:00.000Z',
      },
    ],
  )
})

test('keeps a Subagent running while it is only started or messaged', () => {
  const [subagent] = readSubagents([
    event('started', '2026-09-16T16:38:00.000Z'),
    event('messaged', '2026-09-16T16:38:30.000Z'),
  ])
  assert.equal(subagent?.state, 'running')
  assert.equal(subagent?.endedAt, null)
})

test('names how a Subagent ended', () => {
  const states = (['failed', 'interrupted'] as const).map(
    (state) => readSubagents([event('responded', null, { state })])[0]?.state,
  )
  assert.deepEqual(states, ['failed', 'interrupted'])
})

test('keeps two Subagents apart by id', () => {
  const rows = readSubagents([
    event('started', null, { subagentId: 'one' }),
    event('started', null, { subagentId: 'two' }),
    event('responded', null, { subagentId: 'one' }),
  ])
  assert.deepEqual(
    rows.map((row) => [row.id, row.state]),
    [
      ['one', 'completed'],
      ['two', 'running'],
    ],
  )
})
