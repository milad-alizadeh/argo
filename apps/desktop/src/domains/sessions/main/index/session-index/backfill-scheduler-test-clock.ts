import type { SchedulerClock } from '@/domains/sessions/main/index/session-index/backfill-scheduler'

export function fakeClock() {
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
    advance: async (ms: number) => {
      now += ms
      for (;;) {
        const due = pending.filter((entry) => entry.at <= now)
        if (due.length === 0) return
        for (const entry of due) {
          pending.splice(pending.indexOf(entry), 1)
          entry.run()
        }
        await Promise.resolve()
        await Promise.resolve()
      }
    },
    pendingCount: () => pending.length,
  }
}
