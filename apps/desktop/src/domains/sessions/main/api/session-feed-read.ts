import { createHash, randomUUID } from 'node:crypto'
import { initTRPC, TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { Database } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import {
  type SessionHistoryRow,
  sessionHistoryRowSchema,
} from '@/domains/sessions/api/session-history'
import { type Harness, harnessSchema } from '@/harnesses/harness'
import { identifierSchema } from '@/shared/validation'

const t = initTRPC.create()
const inputSchema = z.strictObject({
  sessionId: identifierSchema,
  subagentId: identifierSchema.nullable().default(null),
})
const outputSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.feed.read'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
  chainId: identifierSchema,
  revision: z.string().min(1),
  rows: z.array(sessionHistoryRowSchema),
})

export type SessionHistoryReader = (
  nativeId: string,
  cwd: string | null,
) => Promise<SessionHistoryRow[]>
export type SessionFeedReadContext = {
  database: Database
  readHistory: (
    harness: Harness,
    nativeId: string,
    cwd: string | null,
  ) => Promise<SessionHistoryRow[]>
}

export function sessionFeedReadProcedure(context: SessionFeedReadContext) {
  return t.procedure
    .input(inputSchema)
    .output(outputSchema)
    .query(async ({ input }) => {
      const stored = context.database
        .select({
          harness: sessionTable.harness,
          nativeId: sessionTable.nativeId,
          cwd: sessionTable.cwd,
        })
        .from(sessionTable)
        .where(eq(sessionTable.argoId, input.sessionId))
        .get()
      if (stored === undefined)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'missing-session' })
      const harness = harnessSchema.parse(stored.harness)
      let rows: SessionHistoryRow[]
      try {
        rows = await context.readHistory(harness, input.subagentId ?? stored.nativeId, stored.cwd)
      } catch {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'vendor-history-unavailable',
        })
      }
      const revision = createHash('sha256').update(JSON.stringify(rows)).digest('hex')
      return {
        version: 1,
        type: 'session.feed.read',
        requestId: randomUUID(),
        sessionId: input.sessionId,
        chainId: input.subagentId ?? input.sessionId,
        revision,
        rows,
      }
    })
}
