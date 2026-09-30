import { initTRPC } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { sessionTable } from '@/database/session/schema'
import { sessionTicketLink } from '@/database/session-ticket-link/schema'
import { identifierSchema } from '@/shared/validation'
import { storedSessionSubagents } from '../database'
import {
  coalescedChanges,
  type SessionListContext,
  sessionIsArchived,
  sessionListRow,
  sessionListRowSchema,
  storedSessionColumns,
} from './session-list'

const t = initTRPC.create()

const sessionDetailsSchema = sessionListRowSchema.extend({
  projectId: z.string().min(1).nullable(),
})

// Each update names the Session it answers, so a reader can drop one for an earlier selection.
const sessionDetailsUpdateSchema = z.strictObject({
  sessionId: identifierSchema,
  details: sessionDetailsSchema.nullable(),
})

// Stored facts come from SQLite and connection facts from the live supervisor; no history is read.
function readSessionDetails(
  context: SessionListContext,
  sessionId: string,
): z.infer<typeof sessionDetailsSchema> | null {
  const stored = context.database
    .select({
      ...storedSessionColumns,
      projectId: sessionTable.projectId,
      archived: sessionIsArchived,
    })
    .from(sessionTable)
    .leftJoin(sessionTicketLink, eq(sessionTicketLink.sessionId, sessionTable.argoId))
    .where(eq(sessionTable.argoId, sessionId))
    .get()
  if (stored === undefined) return null
  const subagents = storedSessionSubagents(context.database, [sessionId]).get(sessionId) ?? []
  const row = sessionListRow(context, { ...stored, archived: Boolean(stored.archived) }, subagents)
  return sessionDetailsSchema.parse({ ...row, projectId: stored.projectId })
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
        const unsubscribeStored = context.roster.subscribe(changed)
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
