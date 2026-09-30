import { afterEach, expect, test, vi } from 'vitest'
import { WATCHED_TURN_QUIET_LIMIT_MS, WatchedSessionStatus } from './watched-session-status'

afterEach(() => {
  vi.useRealTimers()
})

// Each status `record` returns and each quiet timeout, in the order they happen.
function watched() {
  const written: string[] = []
  const status = new WatchedSessionStatus(({ harness, nativeId }) => {
    written.push(`${harness}/${nativeId} unknown`)
  })
  const record = (write: Parameters<WatchedSessionStatus['record']>[0]) => {
    const recorded = status.record(write)
    if (recorded !== undefined) written.push(`${write.harness}/${write.nativeId} ${recorded}`)
  }
  return { status, record, written }
}

test('writes an open turn as running and a closed one as idle', () => {
  const { status, record, written } = watched()
  record({ harness: 'claude', nativeId: 'native-1', turn: 'open', at: 1_000 })
  record({ harness: 'codex', nativeId: 'native-2', turn: 'closed', at: 1_000 })

  expect(written).toEqual(['claude/native-1 running', 'codex/native-2 idle'])
  status.dispose()
})

test('writes a write with no turn marker as a turn under way, once', () => {
  const { status, record, written } = watched()
  record({ harness: 'claude', nativeId: 'native-1', turn: null, at: 1_000 })
  record({ harness: 'claude', nativeId: 'native-1', turn: null, at: 2_000 })

  expect(written).toEqual(['claude/native-1 running'])
  status.dispose()
})

test('writes unknown once an open turn has been quiet too long', () => {
  vi.useFakeTimers()
  const { status, record, written } = watched()
  record({ harness: 'claude', nativeId: 'native-1', turn: 'open', at: 0 })

  vi.advanceTimersByTime(WATCHED_TURN_QUIET_LIMIT_MS - 1)
  record({
    harness: 'claude',
    nativeId: 'native-1',
    turn: 'open',
    at: WATCHED_TURN_QUIET_LIMIT_MS - 1,
  })
  vi.advanceTimersByTime(WATCHED_TURN_QUIET_LIMIT_MS)

  expect(written).toEqual(['claude/native-1 running', 'claude/native-1 unknown'])
  status.dispose()
})

test('keeps a closed turn idle with no timer', () => {
  vi.useFakeTimers()
  const { status, record, written } = watched()
  record({ harness: 'claude', nativeId: 'native-1', turn: 'open', at: 0 })
  record({ harness: 'claude', nativeId: 'native-1', turn: 'closed', at: 10 })
  vi.advanceTimersByTime(2 * WATCHED_TURN_QUIET_LIMIT_MS)

  expect(written).toEqual(['claude/native-1 running', 'claude/native-1 idle'])
  status.dispose()
})

test('writes a status only when a write opens, closes, or wakes a quiet Turn', () => {
  const { status, record, written } = watched()
  const write = (turn: 'open' | 'closed' | null, at: number) =>
    record({ harness: 'claude', nativeId: 'native-1', turn, at })

  write('open', 0)
  write(null, 1_000)
  write('closed', 2_000)
  write(null, 3_000)
  write(null, 3_000 + WATCHED_TURN_QUIET_LIMIT_MS)

  expect(written).toEqual([
    'claude/native-1 running',
    'claude/native-1 idle',
    'claude/native-1 running',
    'claude/native-1 running',
  ])
  status.dispose()
})
