// The pure timer-loop behaviour behind background backfill (#2373): it keeps ticking until
// complete, pauses instead of ticking while a Feed read is in flight, and stops cleanly.
import { describe, expect, test } from 'vitest'
import { createBackfillScheduler } from '@/domains/sessions/main/session-index/backfill-scheduler'
import { fakeClock } from '@/domains/sessions/main/session-index/backfill-scheduler-test-clock'

function testIncompleteBatch() {
  test('ticks immediately on start, and again once the batch reports incomplete', async () => {
    const { clock, advance } = fakeClock()
    let calls = 0
    const scheduler = createBackfillScheduler({
      tick: async () => {
        calls += 1
        return { complete: calls >= 2 }
      },
      isPaused: () => false,
      intervalMs: 100,
      clock,
    })

    scheduler.start()
    await advance(0)
    expect(calls).toBe(1)

    await advance(100)
    expect(calls).toBe(2)
  })
}

function testCompletedBatch() {
  test('stops scheduling once a tick reports complete', async () => {
    const { clock, advance, pendingCount } = fakeClock()
    const scheduler = createBackfillScheduler({
      tick: async () => ({ complete: true }),
      isPaused: () => false,
      intervalMs: 100,
      clock,
    })

    scheduler.start()
    await advance(0)

    expect(pendingCount()).toBe(0)
  })
}

function testCompletedRecovery() {
  test('rechecks a completed index when recovery can replace its worker', async () => {
    const { clock, advance } = fakeClock()
    let calls = 0
    const scheduler = createBackfillScheduler({
      tick: async () => {
        calls += 1
        return { complete: true }
      },
      isPaused: () => false,
      completedRetryMs: 100,
      clock,
    })

    scheduler.start()
    await advance(0)
    await advance(100)

    expect(calls).toBe(2)
  })
}

function testFailedTick() {
  test('retries after an index recovery tick fails', async () => {
    const { clock, advance } = fakeClock()
    let calls = 0
    const scheduler = createBackfillScheduler({
      tick: async () => {
        calls += 1
        if (calls === 1) throw new Error('worker stopped')
        return { complete: true }
      },
      isPaused: () => false,
      intervalMs: 100,
      clock,
    })

    scheduler.start()
    await advance(0)
    await advance(100)

    expect(calls).toBe(2)
  })
}

describe('createBackfillScheduler ticking', () => {
  testIncompleteBatch()
  testCompletedBatch()
  testCompletedRecovery()
  testFailedTick()
})

describe('createBackfillScheduler pause and stop', () => {
  test('retries without ticking while a Feed read is active, then ticks once it clears', async () => {
    const { clock, advance } = fakeClock()
    let paused = true
    let calls = 0
    const scheduler = createBackfillScheduler({
      tick: async () => {
        calls += 1
        return { complete: true }
      },
      isPaused: () => paused,
      intervalMs: 100,
      pausedRetryMs: 10,
      clock,
    })

    scheduler.start()
    await advance(0)
    expect(calls).toBe(0)

    paused = false
    await advance(10)
    expect(calls).toBe(1)
  })

  test('stop cancels a pending tick so it never runs', async () => {
    const { clock, advance } = fakeClock()
    let calls = 0
    const scheduler = createBackfillScheduler({
      tick: async () => {
        calls += 1
        return { complete: false }
      },
      isPaused: () => false,
      intervalMs: 100,
      clock,
    })

    scheduler.start()
    await advance(0)
    expect(calls).toBe(1)

    scheduler.stop()
    await advance(1000)
    expect(calls).toBe(1)
  })
})
