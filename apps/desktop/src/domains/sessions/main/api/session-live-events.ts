import { initTRPC } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import { z } from 'zod'
import type { Database } from '@/database/database'
import type { SessionHistoryTarget } from '@/domains/sessions/api/session-history'
import { sessionLiveUpdateSchema } from '@/domains/sessions/api/session-live-event'
import type { Harness } from '@/harnesses/harness'
import { identifierSchema } from '@/shared/validation'
import type { SessionEventJournal } from '../live/session-event-journal'
import { sessionHistoryIdentity } from './session-history-identity'

const t = initTRPC.create()
const inputSchema = z.strictObject({
  sessionId: identifierSchema,
  cursor: z.number().int().nonnegative(),
})
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
    return observable<z.infer<typeof sessionLiveUpdateSchema>>((emit) => {
      let replaying = true
      const pending: ReturnType<SessionEventJournal['append']>[] = []
      const sendEvent = (event: (typeof pending)[number]) =>
        emit.next(sessionLiveUpdateSchema.parse({ type: 'event', event }))
      const unsubscribe = context.journal.subscribe(input.sessionId, (event) => {
        if (replaying) pending.push(event)
        else sendEvent(event)
      })
      const replay = context.journal.replay(input.sessionId, input.cursor)
      emit.next(
        sessionLiveUpdateSchema.parse({
          type: 'ready',
          live: context.hasLiveChannel(input.sessionId),
          cursor: replay.cursor,
        }),
      )
      if (replay.type === 'expired') emit.next(sessionLiveUpdateSchema.parse(replay))
      else for (const event of replay.events) sendEvent(event)
      replaying = false
      for (const event of pending) if (event.sequence > replay.cursor) sendEvent(event)
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
