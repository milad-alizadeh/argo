import { afterEach, expect, jest, test } from 'bun:test'
import { WATCHED_TURN_QUIET_LIMIT_MS, WatchedSessionStatus } from './watched-session-status'

afterEach(() => {
  jest.useRealTimers()
})

function openTurnWithFakeTimers() {
  jest.useFakeTimers()
  let changes = 0
  const status = new WatchedSessionStatus(() => {
    changes += 1
  })
  status.record({ harness: 'claude', nativeId: 'native-1', turn: 'open', at: 0 })
  return { status, changes: () => changes }
}

test('reads an open turn as running and a closed one as idle', () => {
  const status = new WatchedSessionStatus(() => {})
  status.record({ harness: 'claude', nativeId: 'native-1', turn: 'open', at: 1_000 })
  status.record({ harness: 'codex', nativeId: 'native-2', turn: 'closed', at: 1_000 })

  expect(status.statusOf('claude', 'native-1', 2_000)).toBe('running')
  expect(status.statusOf('codex', 'native-2', 2_000)).toBe('idle')
  expect(status.statusOf('claude', 'native-2', 2_000)).toBeNull()
  status.dispose()
})

test('reads a write with no turn marker as a turn under way', () => {
  const status = new WatchedSessionStatus(() => {})
  status.record({ harness: 'claude', nativeId: 'native-1', turn: null, at: 1_000 })

  expect(status.statusOf('claude', 'native-1', 2_000)).toBe('running')
  status.dispose()
})

test('stops calling an open turn running once its file has been quiet too long', () => {
  const { status, changes } = openTurnWithFakeTimers()

  jest.advanceTimersByTime(WATCHED_TURN_QUIET_LIMIT_MS - 1)
  expect(changes()).toBe(0)
  status.record({
    harness: 'claude',
    nativeId: 'native-1',
    turn: 'open',
    at: WATCHED_TURN_QUIET_LIMIT_MS - 1,
  })
  jest.advanceTimersByTime(WATCHED_TURN_QUIET_LIMIT_MS)

  expect(changes()).toBe(1)
  expect(status.statusOf('claude', 'native-1', 2 * WATCHED_TURN_QUIET_LIMIT_MS)).toBeNull()
  status.dispose()
})

test('keeps a closed turn idle with no timer', () => {
  const { status, changes } = openTurnWithFakeTimers()
  status.record({ harness: 'claude', nativeId: 'native-1', turn: 'closed', at: 10 })
  jest.advanceTimersByTime(2 * WATCHED_TURN_QUIET_LIMIT_MS)

  expect(changes()).toBe(0)
  expect(status.statusOf('claude', 'native-1', 2 * WATCHED_TURN_QUIET_LIMIT_MS)).toBe('idle')
})
