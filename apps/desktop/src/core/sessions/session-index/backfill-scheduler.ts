// A generic timer loop driving one adapter's background indexing (#2373): keep taking backfill
// batches until its older history is fully covered, pausing while a Feed read is in flight rather
// than racing the file it is reading. A real clock drives it from `session-bridges.ts`; a fake one
// drives its own tests, so the pause/resume logic never depends on wall time actually passing.
export type SchedulerClock = {
  setTimeout: (callback: () => void, ms: number) => unknown
  clearTimeout: (handle: unknown) => void
}

const REAL_CLOCK: SchedulerClock = {
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle as Parameters<typeof clearTimeout>[0]),
}

export type BackfillScheduler = { start: () => void; stop: () => void }

export type BackfillSchedulerOptions = {
  // One backfill batch. `complete` once the tick found nothing older left to cover.
  tick: () => Promise<{ complete: boolean }>
  // A selected Feed reading right now: the scheduler retries at `pausedRetryMs` instead of ticking.
  isPaused: () => boolean
  intervalMs?: number
  pausedRetryMs?: number
  clock?: SchedulerClock
}

// A loop that stops scheduling itself once backfill reports complete, and a later `start` (a
// fresh Session index, a restart within the same process) resumes it from wherever the persisted
// boundary now is, exactly as it would after an application restart.
export function createBackfillScheduler(options: BackfillSchedulerOptions): BackfillScheduler {
  const clock = options.clock ?? REAL_CLOCK
  const intervalMs = options.intervalMs ?? 2000
  const pausedRetryMs = options.pausedRetryMs ?? 250
  let handle: unknown = null
  let stopped = true

  function scheduleNext(delay: number) {
    if (stopped) return
    handle = clock.setTimeout(() => void runOnce(), delay)
  }

  async function runOnce() {
    if (stopped) return
    if (options.isPaused()) {
      scheduleNext(pausedRetryMs)
      return
    }
    const { complete } = await options.tick()
    if (!complete) scheduleNext(intervalMs)
  }

  return {
    start: () => {
      if (!stopped) return
      stopped = false
      scheduleNext(0)
    },
    stop: () => {
      stopped = true
      if (handle !== null) clock.clearTimeout(handle)
      handle = null
    },
  }
}
