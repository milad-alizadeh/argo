// The pure timer-loop behaviour behind background backfill (#2373): it keeps ticking until
// complete, pauses instead of ticking while a Feed read is in flight, and stops cleanly.
import { describe, expect, test } from 'vitest'
import { createBackfillScheduler, type SchedulerClock } from './backfill-scheduler'

function fakeClock() {
  const pending: { at: number; run: () => void }[] = []
  let now = 0
  const clock: SchedulerClock = {
    setTimeout: (callback, ms) => {
      const entry = { at: now + ms, run: callback }
      pending.push(entry)
      return entry
    },
    clearTimeout: (handle) => {
      const index = pending.indexOf(handle as { at: number; run: () => void })
      if (index !== -1) pending.splice(index, 1)
    },
  }
  return {
    clock,
    // Runs every timer due by `ms` from now, including ones a run schedules along the way.
    advance: async (ms: number) => {
      now += ms
      for (;;) {
        const due = pending.filter((entry) => entry.at <= now)
        if (due.length === 0) return
        for (const entry of due) {
          pending.splice(pending.indexOf(entry), 1)
          entry.run()
        }
        // Let any promise the run's callback started settle before checking for more due timers.
        await Promise.resolve()
        await Promise.resolve()
      }
    },
    pendingCount: () => pending.length,
  }
}

describe('createBackfillScheduler ticking', () => {
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
