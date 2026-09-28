import { afterEach, expect, spyOn, test } from 'bun:test'
import { queryClient } from '@/platform/renderer/trpc-client'
import { sessionFeedQueryKey } from '../session-queries'
import { applyLiveUpdate } from './use-live-feed-events'

const ready = {
  type: 'ready',
  live: true,
  generation: 'g-1',
  cursor: 0,
  replayExpired: false,
} as const
const invalidate = spyOn(queryClient, 'invalidateQueries')

afterEach(() => invalidate.mockClear())

function apply(reconnected: boolean) {
  applyLiveUpdate({
    selected: 'session-a',
    subagentId: 'child-1',
    update: ready,
    cursor: 0,
    reconnected,
    setState: () => {},
  })
}

test('a reconnect refreshes only the reconnected chain Feed', () => {
  apply(true)
  expect(invalidate.mock.calls).toEqual([
    [{ queryKey: sessionFeedQueryKey('session-a', 'child-1') }],
  ])
})

test('the first ready leaves the initial snapshot read to the history query', () => {
  apply(false)
  expect(invalidate).not.toHaveBeenCalled()
})

test('a replay gap refreshes the Feed and restarts from the reported cursor', () => {
  const cursor = applyLiveUpdate({
    selected: 'session-a',
    subagentId: null,
    update: { ...ready, cursor: 42, replayExpired: true },
    cursor: 3,
    reconnected: false,
    setState: () => {},
  })
  expect(cursor).toBe(42)
  expect(invalidate.mock.calls).toEqual([[{ queryKey: sessionFeedQueryKey('session-a', null) }]])
})
