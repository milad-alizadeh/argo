import { initTRPC, TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { sessionTable } from '@/database/session/schema'
import { type Harness, harnessSchema } from '@/harnesses/harness'
import { identifierSchema } from '@/shared/validation'
import { readSessionRows, type SessionListContext, sessionListRowSchema } from './session-list'
import { updateSession } from './session-update'

const t = initTRPC.create()
const sessionUpdateInputSchema = z.strictObject({
  sessionId: identifierSchema,
  title: z.string().min(1).optional(),
  archived: z.boolean().optional(),
})

export type SessionUpdateProcedureContext = SessionListContext & {
  rename: (request: { harness: Harness; nativeId: string; title: string }) => Promise<void>
}

function readSession(context: SessionUpdateProcedureContext, sessionId: string) {
  const session = context.database
    .select({ harness: sessionTable.harness, nativeId: sessionTable.nativeId })
    .from(sessionTable)
    .where(eq(sessionTable.argoId, sessionId))
    .get()
  if (session === undefined) throw new TRPCError({ code: 'NOT_FOUND', message: 'missing-session' })
  return { ...session, harness: harnessSchema.parse(session.harness) }
}

// Renames or archives one saved Session and returns its row. A title goes to the Harness first.
export function sessionUpdateProcedure(context: SessionUpdateProcedureContext) {
  return t.procedure
    .input(sessionUpdateInputSchema)
    .output(sessionListRowSchema)
    .mutation(async ({ input }) => {
      const session = readSession(context, input.sessionId)
      if (input.title !== undefined) await context.rename({ ...session, title: input.title })
      updateSession(context, input.sessionId, {
        customTitle: input.title,
        archived: input.archived,
      })
      const [row] = readSessionRows(context, eq(sessionTable.argoId, input.sessionId))
      if (row === undefined) throw new TRPCError({ code: 'NOT_FOUND', message: 'missing-session' })
      return row
    })
}
