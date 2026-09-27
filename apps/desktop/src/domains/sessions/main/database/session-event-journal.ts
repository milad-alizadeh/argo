import { and, eq, gt, lte } from 'drizzle-orm'
import type { Database } from '@/database/database'
import { sessionLiveCursor, sessionLiveEvent } from '@/database/session/live-event-schema'
import {
  type SessionLiveEvent,
  type SessionLiveEventBody,
  sessionLiveEventBodySchema,
  sessionLiveEventSchema,
} from '@/domains/sessions/api/session-live-event'

export type SessionEventReplay =
  | { type: 'expired'; cursor: number }
  | { type: 'events'; events: SessionLiveEvent[]; cursor: number }

export class SessionEventJournal {
  private readonly listeners = new Map<string, Set<(event: SessionLiveEvent) => void>>()
  private readonly database: Database
  private readonly limit: number

  constructor(database: Database, limit = 500) {
    if (!Number.isInteger(limit) || limit < 1)
      throw new Error('Session event limit must be positive.')
    this.database = database
    this.limit = limit
  }

  append(sessionId: string, value: SessionLiveEventBody): SessionLiveEvent {
    const body = sessionLiveEventBodySchema.parse(value)
    const event = this.database.transaction((transaction) => {
      const prior =
        transaction
          .select({ sequence: sessionLiveCursor.sequence })
          .from(sessionLiveCursor)
          .where(eq(sessionLiveCursor.sessionId, sessionId))
          .get()?.sequence ?? 0
      const sequence = prior + 1
      const next = sessionLiveEventSchema.parse({ sessionId, sequence, ...body })
      transaction
        .insert(sessionLiveCursor)
        .values({ sessionId, sequence })
        .onConflictDoUpdate({ target: sessionLiveCursor.sessionId, set: { sequence } })
        .run()
      transaction
        .insert(sessionLiveEvent)
        .values({ sessionId, sequence, payload: JSON.stringify(next) })
        .run()
      transaction
        .delete(sessionLiveEvent)
        .where(
          and(
            eq(sessionLiveEvent.sessionId, sessionId),
            lte(sessionLiveEvent.sequence, sequence - this.limit),
          ),
        )
        .run()
      return next
    })
    for (const listener of this.listeners.get(sessionId) ?? []) listener(event)
    return event
  }

  replay(sessionId: string, after: number): SessionEventReplay {
    if (!Number.isInteger(after) || after < 0) throw new Error('Session event cursor is invalid.')
    const cursor =
      this.database
        .select({ sequence: sessionLiveCursor.sequence })
        .from(sessionLiveCursor)
        .where(eq(sessionLiveCursor.sessionId, sessionId))
        .get()?.sequence ?? 0
    if (after > cursor || after < Math.max(0, cursor - this.limit))
      return { type: 'expired', cursor }
    const rows = this.database
      .select({ payload: sessionLiveEvent.payload })
      .from(sessionLiveEvent)
      .where(and(eq(sessionLiveEvent.sessionId, sessionId), gt(sessionLiveEvent.sequence, after)))
      .orderBy(sessionLiveEvent.sequence)
      .all()
    return {
      type: 'events',
      events: rows.map(({ payload }) => sessionLiveEventSchema.parse(JSON.parse(payload))),
      cursor,
    }
  }

  subscribe(sessionId: string, listener: (event: SessionLiveEvent) => void): () => void {
    const listeners = this.listeners.get(sessionId) ?? new Set()
    listeners.add(listener)
    this.listeners.set(sessionId, listeners)
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) this.listeners.delete(sessionId)
    }
  }
}
