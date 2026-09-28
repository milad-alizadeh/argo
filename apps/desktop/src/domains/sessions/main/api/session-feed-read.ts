import { createHash, randomUUID } from 'node:crypto'
import { initTRPC, TRPCError } from '@trpc/server'
import { z } from 'zod'
import type { Database } from '@/database/database'
import { type FeedContent, feedContentSchema } from '@/domains/sessions/api/feed-content'
import type { SessionHistoryTarget } from '@/domains/sessions/api/session-history'
import type { Harness } from '@/harnesses/harness'
import { identifierSchema } from '@/shared/validation'
import { sessionHistoryIdentity } from './session-history-identity'

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
})

export type SessionFeedReadContext = {
  database: Database
  readHistory: (harness: Harness, target: SessionHistoryTarget) => Promise<FeedContent[]>
}

// Each read returns the chain's complete history.
export function sessionFeedReadProcedure(context: SessionFeedReadContext) {
  return t.procedure
    .input(inputSchema)
    .output(outputSchema)
    .query(async ({ input }) => {
      const stored = sessionHistoryIdentity(context.database, input.sessionId)
      const chainId = input.subagentId ?? input.sessionId
      let content: FeedContent[]
      try {
        content = await context.readHistory(stored.harness, {
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
      const revision = createHash('sha256').update(JSON.stringify(content)).digest('hex')
      return {
        version: 1,
        type: 'session.feed.read',
        requestId: randomUUID(),
        sessionId: input.sessionId,
        chainId,
        revision,
        content,
      }
    })
}
