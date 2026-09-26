import { initTRPC, TRPCError } from '@trpc/server'
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { Database } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import { type Harness, harnessSchema } from '@/harnesses/harness'
import { identifierSchema } from '@/shared/validation'

const t = initTRPC.create()
export const sessionRenameInputSchema = z.strictObject({
  sessionId: identifierSchema,
  title: z.string().min(1),
})
export const sessionRenameOutputSchema = z.strictObject({ title: z.string().min(1) })

export type SessionRenameContext = {
  database: Database
  rename: (request: { harness: Harness; nativeId: string; title: string }) => Promise<void>
}

function readSession(context: SessionRenameContext, sessionId: string) {
  const session = context.database
    .select({ harness: sessionTable.harness, nativeId: sessionTable.nativeId })
    .from(sessionTable)
    .where(eq(sessionTable.argoId, sessionId))
    .get()
  if (session === undefined) throw new TRPCError({ code: 'NOT_FOUND', message: 'missing-session' })
  return { ...session, harness: harnessSchema.parse(session.harness) }
}

export function sessionRenameProcedure(context: SessionRenameContext) {
  return t.procedure
    .input(sessionRenameInputSchema)
    .output(sessionRenameOutputSchema)
    .mutation(async ({ input }) => {
      const session = readSession(context, input.sessionId)
      await context.rename({ ...session, title: input.title })
      const updated = context.database
        .update(sessionTable)
        .set({
          customTitle: input.title,
          updatedAt: sql`MAX(CAST(unixepoch('subsec') * 1000 AS INTEGER), ${sessionTable.updatedAt} + 1)`,
        })
        .where(eq(sessionTable.argoId, input.sessionId))
        .returning({ title: sessionTable.customTitle })
        .get()
      if (updated?.title === null || updated === undefined)
        throw new Error('Session title did not persist.')
      return { title: updated.title }
    })
}
