import { initTRPC } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { Database } from '@/database/database'
import { sessionSyncStatus } from '@/database/session-sync/schema'

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

function persistedStatus(database: Database, harness: string): SessionSyncStatus {
  const row = database
    .select()
    .from(sessionSyncStatus)
    .where(eq(sessionSyncStatus.harness, harness))
    .get()
  if (row === undefined) return initialSessionSyncStatus
  return sessionSyncStatusSchema.parse({
    phase: row.phase,
    processed: row.processed,
    total: row.total,
    skipped: row.skipped,
    lastSuccessfulSyncAt:
      row.lastSuccessfulSyncAt === null ? null : new Date(row.lastSuccessfulSyncAt).toISOString(),
    failure: row.failure,
  })
}

export class SessionSyncStatusStore {
  #status: SessionSyncStatus
  #listeners = new Set<(status: SessionSyncStatus) => void>()
  private readonly database: Database | undefined
  private readonly harness: string

  constructor(database?: Database, harness = 'claude') {
    this.database = database
    this.harness = harness
    this.#status =
      database === undefined ? initialSessionSyncStatus : persistedStatus(database, harness)
  }

  current(): SessionSyncStatus {
    return this.#status
  }

  update(status: SessionSyncStatus): void {
    this.#status = sessionSyncStatusSchema.parse(status)
    if (this.database === undefined) {
      for (const listener of this.#listeners) listener(this.#status)
      return
    }
    this.database
      .insert(sessionSyncStatus)
      .values({
        harness: this.harness,
        phase: this.#status.phase,
        processed: this.#status.processed,
        total: this.#status.total,
        skipped: this.#status.skipped,
        lastSuccessfulSyncAt:
          this.#status.lastSuccessfulSyncAt === null
            ? null
            : new Date(this.#status.lastSuccessfulSyncAt).getTime(),
        failure: this.#status.failure,
      })
      .onConflictDoUpdate({
        target: sessionSyncStatus.harness,
        set: {
          phase: this.#status.phase,
          processed: this.#status.processed,
          total: this.#status.total,
          skipped: this.#status.skipped,
          lastSuccessfulSyncAt:
            this.#status.lastSuccessfulSyncAt === null
              ? null
              : new Date(this.#status.lastSuccessfulSyncAt).getTime(),
          failure: this.#status.failure,
          updatedAt: sql`MAX(CAST(unixepoch('subsec') * 1000 AS INTEGER), ${sessionSyncStatus.updatedAt} + 1)`,
        },
      })
      .run()
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
