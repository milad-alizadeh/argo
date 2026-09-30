import { initTRPC } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { sessionTable } from '@/database/session/schema'
import { identifierSchema } from '@/shared/validation'
import {
  coalescedChanges,
  readSessionRows,
  type SessionListContext,
  sessionListRowSchema,
} from './session-list'

const t = initTRPC.create()

// Each update names the Session it answers, so a reader can drop one for an earlier selection.
const sessionDetailsUpdateSchema = z.strictObject({
  sessionId: identifierSchema,
  details: sessionListRowSchema.nullable(),
})

// Stored facts come from SQLite and connection facts from the live supervisor; no history is read.
function readSessionDetails(context: SessionListContext, sessionId: string) {
  return readSessionRows(context, eq(sessionTable.argoId, sessionId))[0] ?? null
}

export function sessionDetailsProcedure(context: SessionListContext) {
  return t.procedure
    .input(z.strictObject({ sessionId: identifierSchema }))
    .subscription(({ input: { sessionId } }) =>
      observable<z.infer<typeof sessionDetailsUpdateSchema>>((emit) => {
        const initial = readSessionDetails(context, sessionId)
        let sent = JSON.stringify(initial)
        emit.next({ sessionId, details: initial })
        const { changed, stop } = coalescedChanges(() => {
          const details = readSessionDetails(context, sessionId)
          const next = JSON.stringify(details)
          if (next === sent) return
          sent = next
          emit.next({ sessionId, details })
        })
        const unsubscribeStored = context.roster.subscribe((sessionIds) => {
          if (sessionIds.includes(sessionId)) changed()
        })
        const liveChanges = context.supervisor.on('Session status changed', (event) => {
          if (event.sessionId === sessionId) changed()
        })
        return () => {
          stop()
          unsubscribeStored()
          liveChanges.unsubscribe()
        }
      }),
    )
}
