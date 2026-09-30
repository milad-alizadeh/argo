import { initTRPC, TRPCError } from '@trpc/server'
import { eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { sessionTable } from '@/database/session/schema'
import { type Harness, harnessSchema } from '@/harnesses/harness'
import { identifierSchema } from '@/shared/validation'
import { readSessionRows, type SessionListContext, sessionListRowSchema } from './session-list'
import { updateSession } from './session-update'

const t = initTRPC.create()
const sessionUpdateInputSchema = z
  .strictObject({
    sessionIds: z.array(identifierSchema).min(1),
    title: z.string().min(1).optional(),
    archived: z.boolean().optional(),
  })
  .refine((input) => input.title === undefined || input.sessionIds.length === 1, {
    message: 'A title renames exactly one Session.',
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

// Renames one saved Session or archives several, and returns the updated rows. A title goes to the
// Harness first; an unknown ID is skipped.
export function sessionUpdateProcedure(context: SessionUpdateProcedureContext) {
  return t.procedure
    .input(sessionUpdateInputSchema)
    .output(z.array(sessionListRowSchema))
    .mutation(async ({ input }) => {
      const [renamed] = input.sessionIds
      if (input.title !== undefined && renamed !== undefined)
        await context.rename({ ...readSession(context, renamed), title: input.title })
      const updated = input.sessionIds.filter((sessionId) =>
        updateSession(context, sessionId, { customTitle: input.title, archived: input.archived }),
      )
      return readSessionRows(context, inArray(sessionTable.argoId, updated))
    })
}
