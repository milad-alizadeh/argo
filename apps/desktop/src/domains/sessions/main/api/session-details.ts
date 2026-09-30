import { initTRPC } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { sessionTable } from '@/database/session/schema'
import { identifierSchema } from '@/shared/validation'
import { readSessionRows, type SessionListContext, sessionListRowSchema } from './session-list'

const t = initTRPC.create()

// Stored facts come from SQLite and connection facts from the live supervisor; no history is read.
export function sessionDetailsProcedure(context: SessionListContext) {
  return t.procedure
    .input(z.strictObject({ sessionId: identifierSchema }))
    .output(sessionListRowSchema.nullable())
    .query(
      ({ input }) => readSessionRows(context, eq(sessionTable.argoId, input.sessionId))[0] ?? null,
    )
}
