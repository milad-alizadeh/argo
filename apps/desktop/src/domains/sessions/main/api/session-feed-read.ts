import { createHash, randomUUID } from 'node:crypto'
import { initTRPC, TRPCError } from '@trpc/server'
import { z } from 'zod'
import type { Database } from '@/database/database'
import { type FeedContent, feedContentSchema } from '@/domains/sessions/api/feed-content'
import type { SessionHistoryTarget } from '@/domains/sessions/api/session-history'
import type { Harness } from '@/harnesses/harness'
import { identifierSchema } from '@/shared/validation'
import { SessionFeedPages } from './session-feed-pages'
import { sessionHistoryIdentity } from './session-history-identity'

const t = initTRPC.create()
const inputSchema = z.strictObject({
  sessionId: identifierSchema,
  subagentId: identifierSchema.nullable().default(null),
  before: z.string().min(1).max(2048).nullable().default(null),
})
const outputSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.feed.read'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
  chainId: identifierSchema,
  revision: z.string().min(1),
  olderCursor: z.string().nullable(),
  content: z.array(feedContentSchema),
})

export type SessionFeedReadContext = {
  database: Database
  readHistory: (harness: Harness, target: SessionHistoryTarget) => Promise<FeedContent[]>
}

export function sessionFeedReadProcedure(context: SessionFeedReadContext) {
  const pages = new SessionFeedPages()
  return t.procedure
    .input(inputSchema)
    .output(outputSchema)
    .query(async ({ input }) => {
      const stored = sessionHistoryIdentity(context.database, input.sessionId)
      const chainId = input.subagentId ?? input.sessionId
      let page: { content: FeedContent[]; olderCursor: string | null }
      try {
        page = await pages.read({
          sessionId: input.sessionId,
          chainId,
          before: input.before,
          readHistory: () =>
            context.readHistory(stored.harness, {
              nativeId: stored.nativeId,
              subagentId: input.subagentId,
              cwd: stored.cwd,
            }),
        })
      } catch (error) {
        if (error instanceof Error && error.message === 'invalid-feed-cursor')
          throw new TRPCError({ code: 'BAD_REQUEST', message: error.message })
        if (error instanceof Error && error.message === 'expired-feed-cursor')
          throw new TRPCError({ code: 'CONFLICT', message: error.message })
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'vendor-history-unavailable',
        })
      }
      const { content, olderCursor } = page
      const revision = createHash('sha256').update(JSON.stringify(content)).digest('hex')
      return {
        version: 1,
        type: 'session.feed.read',
        requestId: randomUUID(),
        sessionId: input.sessionId,
        chainId,
        revision,
        olderCursor,
        content,
      }
    })
}
