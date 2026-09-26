import { initTRPC } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import { z } from 'zod'

export const sessionSyncStatusSchema = z.strictObject({
  phase: z.enum(['idle', 'fetching', 'saving', 'ready', 'failed']),
  processed: z.number().int().nonnegative(),
  total: z.number().int().nonnegative().nullable(),
  skipped: z.number().int().nonnegative(),
  lastSuccessfulSyncAt: z.string().datetime().nullable(),
  failure: z.string().nullable(),
})

export type SessionSyncStatus = z.infer<typeof sessionSyncStatusSchema>
export const initialSessionSyncStatus: SessionSyncStatus = {
  phase: 'idle',
  processed: 0,
  total: null,
  skipped: 0,
  lastSuccessfulSyncAt: null,
  failure: null,
}

export class SessionSyncStatusStore {
  #status = initialSessionSyncStatus
  #listeners = new Set<(status: SessionSyncStatus) => void>()

  current(): SessionSyncStatus {
    return this.#status
  }

  update(status: SessionSyncStatus): void {
    this.#status = sessionSyncStatusSchema.parse(status)
    for (const listener of this.#listeners) listener(this.#status)
  }

  subscribe(listener: (status: SessionSyncStatus) => void): () => void {
    this.#listeners.add(listener)
    listener(this.#status)
    return () => this.#listeners.delete(listener)
  }

  observable() {
    return observable<SessionSyncStatus>((emit) => this.subscribe((status) => emit.next(status)))
  }
}

const t = initTRPC.create()

export function sessionSyncStatusProcedure(store: SessionSyncStatusStore) {
  return t.procedure.subscription(() => store.observable())
}
