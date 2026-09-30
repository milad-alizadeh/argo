import { initTRPC } from '@trpc/server'
import { z } from 'zod'
import { identifierSchema } from '@/shared/validation'
import { readSessionRow, type SessionListContext, sessionListRowSchema } from './session-list'

const t = initTRPC.create()

// Stored facts come from SQLite and connection facts from the live supervisor; no history is read.
export function sessionDetailsProcedure(context: SessionListContext) {
  return t.procedure
    .input(z.strictObject({ sessionId: identifierSchema }))
    .output(sessionListRowSchema.nullable())
    .query(({ input }) => readSessionRow(context, input.sessionId))
}
