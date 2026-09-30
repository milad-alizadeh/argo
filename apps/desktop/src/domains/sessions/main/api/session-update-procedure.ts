import { initTRPC } from '@trpc/server'
import { z } from 'zod'
import type { Harness } from '@/harnesses/harness'
import { identifierSchema } from '@/shared/validation'
import { sessionHistoryIdentity } from './session-history-identity'
import type { SessionListContext } from './session-list'
import { updateSession } from './session-update'

const t = initTRPC.create()
const sessionUpdateInputSchema = z
  .strictObject({
    sessionIds: z.array(identifierSchema).min(1),
    // Control characters become spaces, and runs of space become one.
    title: z
      .string()
      .transform((title) =>
        title
          .replace(/\p{Cc}/gu, ' ')
          .trim()
          .replace(/\s+/g, ' '),
      )
      .pipe(z.string().min(1))
      .optional(),
    archived: z.boolean().optional(),
  })
  .refine((input) => input.title === undefined || input.sessionIds.length === 1, {
    message: 'A title renames exactly one Session.',
  })

export type SessionUpdateProcedureContext = SessionListContext & {
  rename: (request: { harness: Harness; nativeId: string; title: string }) => Promise<void>
}

// Renames one saved Session or archives several, and returns the updated IDs. A title goes to the
// Harness first; an unknown ID is skipped.
export function sessionUpdateProcedure(context: SessionUpdateProcedureContext) {
  return t.procedure
    .input(sessionUpdateInputSchema)
    .output(z.strictObject({ sessionIds: z.array(identifierSchema) }))
    .mutation(async ({ input }) => {
      const [renamed] = input.sessionIds
      if (input.title !== undefined && renamed !== undefined) {
        const { harness, nativeId } = sessionHistoryIdentity(context.database, renamed)
        await context.rename({ harness, nativeId, title: input.title })
      }
      const sessionIds = input.sessionIds.filter((sessionId) =>
        updateSession(context, sessionId, { customTitle: input.title, archived: input.archived }),
      )
      return { sessionIds }
    })
}
