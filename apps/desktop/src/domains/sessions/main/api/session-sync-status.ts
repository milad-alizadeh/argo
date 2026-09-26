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
export const sessionSyncEventSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('status'), status: sessionSyncStatusSchema }),
  z.strictObject({ type: z.literal('committed') }),
])

export type SessionSyncEvent = z.infer<typeof sessionSyncEventSchema>
const initialSessionSyncStatus: SessionSyncStatus = {
  phase: 'idle',
  processed: 0,
  total: null,
  skipped: 0,
  lastSuccessfulSyncAt: null,
  failure: null,
}

function completedStatus(database: Database, harness: string): SessionSyncStatus {
  const row = database
    .select()
    .from(sessionSyncStatus)
    .where(eq(sessionSyncStatus.harness, harness))
    .get()
  if (row === undefined) return initialSessionSyncStatus
  let completed: boolean
  switch (row.phase) {
    case 'ready':
    case 'failed':
      completed = true
      break
    case 'idle':
    case 'fetching':
    case 'saving':
      completed = false
      break
    default:
      throw new Error(`Unknown persisted Session sync phase: ${row.phase}`)
  }
  return sessionSyncStatusSchema.parse({
    phase: completed ? row.phase : 'idle',
    processed: completed ? row.processed : 0,
    total: completed ? row.total : null,
    skipped: completed ? row.skipped : 0,
    lastSuccessfulSyncAt:
      row.lastSuccessfulSyncAt === null ? null : new Date(row.lastSuccessfulSyncAt).toISOString(),
    failure: row.phase === 'failed' ? row.failure : null,
  })
}

export class SessionSyncStatusStore {
  #status: SessionSyncStatus
  #listeners = new Set<(event: SessionSyncEvent) => void>()
  private readonly database: Database | undefined
  private readonly harness: string

  constructor(database?: Database, harness = 'claude') {
    this.database = database
    this.harness = harness
    this.#status =
      database === undefined ? initialSessionSyncStatus : completedStatus(database, harness)
  }

  current(): SessionSyncStatus {
    return this.#status
  }

  update(status: SessionSyncStatus): void {
    this.#status = sessionSyncStatusSchema.parse({
      ...status,
      lastSuccessfulSyncAt: status.lastSuccessfulSyncAt ?? this.#status.lastSuccessfulSyncAt,
    })
    if (
      this.database !== undefined &&
      (this.#status.phase === 'ready' || this.#status.phase === 'failed')
    ) {
      const completed = this.#status
      const values = {
        phase: completed.phase,
        processed: completed.processed,
        total: completed.total,
        skipped: completed.skipped,
        lastSuccessfulSyncAt:
          completed.lastSuccessfulSyncAt === null
            ? null
            : new Date(completed.lastSuccessfulSyncAt).getTime(),
        failure: completed.failure,
      }
      this.database
        .insert(sessionSyncStatus)
        .values({ harness: this.harness, ...values })
        .onConflictDoUpdate({
          target: sessionSyncStatus.harness,
          set: {
            ...values,
            updatedAt: sql`MAX(CAST(unixepoch('subsec') * 1000 AS INTEGER), ${sessionSyncStatus.updatedAt} + 1)`,
          },
        })
        .run()
    }
    this.emit({ type: 'status', status: this.#status })
  }

  committed(): void {
    this.emit({ type: 'committed' })
  }

  subscribe(listener: (event: SessionSyncEvent) => void): () => void {
    this.#listeners.add(listener)
    listener({ type: 'status', status: this.#status })
    return () => this.#listeners.delete(listener)
  }

  observable() {
    return observable<SessionSyncEvent>((emit) => this.subscribe((event) => emit.next(event)))
  }

  private emit(event: SessionSyncEvent): void {
    for (const listener of this.#listeners) listener(event)
  }
}

const t = initTRPC.create()

export function sessionSyncStatusProcedure(store: SessionSyncStatusStore) {
  return t.procedure.subscription(() => store.observable())
}
