import { initTRPC } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import { z } from 'zod'
import type { Database } from '@/database/database'
import type { SessionHistoryTarget } from '@/domains/sessions/api/session-history'
import {
  type SessionLiveEvent,
  sessionLiveUpdateSchema,
} from '@/domains/sessions/api/session-live-event'
import type { Harness } from '@/harnesses/harness'
import { identifierSchema } from '@/shared/validation'
import type { SessionEventJournal } from '../live/session-event-journal'
import { sessionHistoryIdentity } from './session-history-identity'

const t = initTRPC.create()
const inputSchema = z.strictObject({
  sessionId: identifierSchema,
  subagentId: identifierSchema.nullable().optional(),
  cursor: z.number().int().nonnegative(),
})

function canDeliver(event: SessionLiveEvent, live: boolean): boolean {
  if (live) return true
  switch (event.type) {
    case 'permission':
      return false
    case 'question':
      return event.answer !== null
    case 'content':
    case 'status':
    case 'failure':
      return true
  }
}

export type SessionLiveEventsContext = {
  database: Database
  journal: SessionEventJournal
  hasLiveChannel: (sessionId: string) => boolean
  watchHistory?: (
    harness: Harness,
    target: SessionHistoryTarget,
    invalidate: () => void,
  ) => () => void
}

export function sessionLiveEventsProcedure(context: SessionLiveEventsContext) {
  return t.procedure.input(inputSchema).subscription(({ input }) => {
    const stored = sessionHistoryIdentity(context.database, input.sessionId)
    const subagentId = input.subagentId ?? null
    if (subagentId !== null)
      return observable<z.infer<typeof sessionLiveUpdateSchema>>((emit) => {
        emit.next(sessionLiveUpdateSchema.parse({ type: 'ready', live: false, cursor: 0 }))
        const unwatch = context.watchHistory?.(
          stored.harness,
          { nativeId: stored.nativeId, subagentId, cwd: stored.cwd },
          () => emit.next(sessionLiveUpdateSchema.parse({ type: 'invalidated' })),
        )
        return () => unwatch?.()
      })
    return observable<z.infer<typeof sessionLiveUpdateSchema>>((emit) => {
      let replaying = true
      const pending: ReturnType<SessionEventJournal['append']>[] = []
      const sendEvent = (event: (typeof pending)[number], live: boolean) => {
        if (canDeliver(event, live))
          emit.next(sessionLiveUpdateSchema.parse({ type: 'event', event }))
      }
      const unsubscribe = context.journal.subscribe(input.sessionId, (event) => {
        if (replaying) pending.push(event)
        else sendEvent(event, context.hasLiveChannel(input.sessionId))
      })
      const replay = context.journal.replay(input.sessionId, input.cursor)
      const live = context.hasLiveChannel(input.sessionId)
      emit.next(
        sessionLiveUpdateSchema.parse({
          type: 'ready',
          live,
          cursor: replay.cursor,
        }),
      )
      if (replay.type === 'expired') emit.next(sessionLiveUpdateSchema.parse(replay))
      else for (const event of replay.events) sendEvent(event, live)
      replaying = false
      for (const event of pending)
        if (event.sequence > replay.cursor)
          sendEvent(event, context.hasLiveChannel(input.sessionId))
      const unwatch = context.watchHistory?.(
        stored.harness,
        { nativeId: stored.nativeId, subagentId: null, cwd: stored.cwd },
        () => emit.next(sessionLiveUpdateSchema.parse({ type: 'invalidated' })),
      )
      return () => {
        unsubscribe()
        unwatch?.()
      }
    })
  })
}
