import { initTRPC } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { sessionTable } from '@/database/session/schema'
import { sessionSelectSchema } from '@/database/session/validation'
import { contextUsageSchema } from '@/domains/sessions/api/context-usage'
import { reportedTurnConfigurationSchema } from '@/domains/sessions/api/reported-turn-configuration'
import { identifierSchema } from '@/shared/validation'
import {
  readSessionListRow,
  type SessionListContext,
  sessionListRowSchema,
  storedValue,
} from './session-list'

const t = initTRPC.create()

// The selected Session's facts: its roster row and what only the Session screen draws.
export const sessionDetailsSchema = sessionListRowSchema.extend({
  projectId: sessionSelectSchema.shape.projectId,
  cwd: sessionSelectSchema.shape.cwd,
  posture: z.literal('live').nullable(),
  turnConfiguration: reportedTurnConfigurationSchema,
  contextUsage: contextUsageSchema.nullable(),
})

async function readSessionDetails(
  context: SessionListContext,
  sessionId: string,
): Promise<z.infer<typeof sessionDetailsSchema> | null> {
  const listed = await readSessionListRow(context, sessionId)
  if (listed === null) return null
  const stored = context.database
    .select({
      projectId: sessionTable.projectId,
      cwd: sessionTable.cwd,
      turnConfiguration: sessionTable.turnConfiguration,
      contextUsage: sessionTable.contextUsage,
    })
    .from(sessionTable)
    .where(eq(sessionTable.argoId, sessionId))
    .get()
  if (stored === undefined) return null
  const { row, live } = listed
  return {
    ...row,
    projectId: stored.projectId,
    cwd: stored.cwd,
    posture: live === null ? null : 'live',
    // A live channel's own configuration outranks the stored one, as its status does.
    turnConfiguration: live?.turnConfiguration ??
      storedValue(
        reportedTurnConfigurationSchema,
        stored.turnConfiguration,
        'turn configuration',
      ) ?? { model: null, effort: null, mode: null },
    contextUsage:
      live?.contextUsage ?? storedValue(contextUsageSchema, stored.contextUsage, 'context usage'),
  }
}

// Stored facts come from SQLite and connection facts from the live supervisor; no history is read.
export function sessionDetailsProcedure(context: SessionListContext) {
  return t.procedure
    .input(z.strictObject({ sessionId: identifierSchema }))
    .output(sessionDetailsSchema.nullable())
    .query(({ input }) => readSessionDetails(context, input.sessionId))
}
