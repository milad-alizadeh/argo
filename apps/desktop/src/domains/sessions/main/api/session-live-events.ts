import { initTRPC, TRPCError } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { Database } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import { sessionLiveUpdateSchema } from '@/domains/sessions/api/session-live-event'
import { identifierSchema } from '@/shared/validation'
import type { SessionEventJournal } from '../live/session-event-journal'

const t = initTRPC.create()
const inputSchema = z.strictObject({
  sessionId: identifierSchema,
  cursor: z.number().int().nonnegative(),
})
export type SessionLiveEventsContext = {
  database: Database
  journal: SessionEventJournal
  hasLiveChannel: (sessionId: string) => boolean
}

export function sessionLiveEventsProcedure(context: SessionLiveEventsContext) {
  return t.procedure.input(inputSchema).subscription(({ input }) => {
    const exists = context.database
      .select({ id: sessionTable.argoId })
      .from(sessionTable)
      .where(eq(sessionTable.argoId, input.sessionId))
      .get()
    if (exists === undefined) throw new TRPCError({ code: 'NOT_FOUND', message: 'missing-session' })
    return observable<z.infer<typeof sessionLiveUpdateSchema>>((emit) => {
      const replay = context.journal.replay(input.sessionId, input.cursor)
      emit.next(
        sessionLiveUpdateSchema.parse({
          type: 'ready',
          live: context.hasLiveChannel(input.sessionId),
          cursor: replay.cursor,
        }),
      )
      if (replay.type === 'expired') emit.next(sessionLiveUpdateSchema.parse(replay))
      else
        for (const event of replay.events)
          emit.next(sessionLiveUpdateSchema.parse({ type: 'event', event }))
      return context.journal.subscribe(input.sessionId, (event) =>
        emit.next(sessionLiveUpdateSchema.parse({ type: 'event', event })),
      )
    })
  })
}
