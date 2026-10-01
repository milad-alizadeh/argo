import { initTRPC } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import { z } from 'zod'
import type { Harness } from '@/harnesses/harness'

export const sessionSyncStatusSchema = z.strictObject({
  phase: z.enum(['idle', 'fetching', 'saving', 'ready', 'failed']),
  processed: z.number().int().nonnegative(),
  total: z.number().int().nonnegative().nullable(),
  skipped: z.number().int().nonnegative(),
  failure: z.string().nullable(),
})

export type SessionSyncStatus = z.infer<typeof sessionSyncStatusSchema>
export type SessionSyncEvent = { type: 'status'; status: SessionSyncStatus }
export const IDLE_SESSION_SYNC_STATUS: SessionSyncStatus = {
  phase: 'idle',
  processed: 0,
  total: null,
  skipped: 0,
  failure: null,
}
// Earlier phases win: one active scan keeps the whole sync active.
const PHASE_PRECEDENCE: readonly SessionSyncStatus['phase'][] = [
  'fetching',
  'saving',
  'failed',
  'ready',
  'idle',
]

function combinedStatus(statuses: readonly SessionSyncStatus[]): SessionSyncStatus {
  const started = statuses.filter(({ phase }) => phase !== 'idle')
  return {
    phase:
      PHASE_PRECEDENCE.find((phase) => statuses.some((status) => status.phase === phase)) ?? 'idle',
    processed: statuses.reduce((sum, { processed }) => sum + processed, 0),
    total:
      started.length === 0 || started.some(({ total }) => total === null)
        ? null
        : started.reduce((sum, { total }) => sum + (total ?? 0), 0),
    skipped: statuses.reduce((sum, { skipped }) => sum + skipped, 0),
    failure: statuses.find(({ failure }) => failure !== null)?.failure ?? null,
  }
}

// What the status subscription reads: the sync supervisor's per-Harness status.
export type SessionSyncStatusSource = {
  getSnapshot: () => { context: { status: Partial<Record<Harness, SessionSyncStatus>> } }
  subscribe: (listener: () => void) => { unsubscribe: () => void }
}

// Reports every Harness scan as one status: the current one, then each change to it.
export function observeSessionSync(
  source: SessionSyncStatusSource,
  listener: (event: SessionSyncEvent) => void,
): () => void {
  let reported = ''
  const report = () => {
    const status = combinedStatus(Object.values(source.getSnapshot().context.status))
    const key = JSON.stringify(status)
    if (key === reported) return
    reported = key
    listener({ type: 'status', status })
  }
  const subscription = source.subscribe(report)
  report()
  return () => subscription.unsubscribe()
}

const t = initTRPC.create()

export function sessionSyncStatusProcedure(source: SessionSyncStatusSource) {
  return t.procedure.subscription(() =>
    observable<SessionSyncEvent>((emit) => observeSessionSync(source, (event) => emit.next(event))),
  )
}
