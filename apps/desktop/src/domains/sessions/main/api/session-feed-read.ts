import { createHash, randomUUID } from 'node:crypto'
import { initTRPC, TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { Database } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import { type FeedContent, feedContentSchema } from '@/domains/sessions/api/feed-content'
import {
  projectSessionHistoryRows,
  type SessionHistoryTarget,
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
  content: z.array(feedContentSchema),
  rows: z.array(sessionHistoryRowSchema),
})

export type SessionFeedReadContext = {
  database: Database
  readHistory: (harness: Harness, target: SessionHistoryTarget) => Promise<FeedContent[]>
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
      let content: FeedContent[]
      try {
        content = await context.readHistory(harness, {
          nativeId: stored.nativeId,
          subagentId: input.subagentId,
          cwd: stored.cwd,
        })
      } catch {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'vendor-history-unavailable',
        })
      }
      const rows = projectSessionHistoryRows(content)
      const revision = createHash('sha256').update(JSON.stringify(content)).digest('hex')
      return {
        version: 1,
        type: 'session.feed.read',
        requestId: randomUUID(),
        sessionId: input.sessionId,
        chainId: input.subagentId ?? input.sessionId,
        revision,
        content,
        rows,
      }
    })
}
