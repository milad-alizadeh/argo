import { initTRPC } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import { z } from 'zod'
import {
  type FeedReading,
  type FeedReadingMessage,
  feedReadingChange,
} from '@/domains/sessions/api/feed'
import { identifierSchema } from '@/shared/validation'
import type { SessionFeedReaders } from '../feed'

const t = initTRPC.create()
const inputSchema = z.strictObject({
  sessionId: identifierSchema,
  // A Subagent's own chain; null reads the root Session.
  subagentId: identifierSchema.nullable().default(null),
})
const refreshOutputSchema = z.strictObject({ accepted: z.boolean() })
const olderOutputSchema = z.strictObject({ accepted: z.boolean() })

// Observe publishes each changed reading of a root Session's or a Subagent's Feed, whole and then
// as changes to the one it sent before; Refresh starts a real read of the same chain, and Older
// puts the page before the published one into the Feed.
export function sessionFeedProcedures(readers: SessionFeedReaders) {
  return {
    sessionFeed: t.procedure.input(inputSchema).subscription(({ input }) =>
      observable<FeedReadingMessage>((emit) => {
        let sent: FeedReading | null = null
        return readers.observe(input, (reading) => {
          emit.next(sent === null ? reading : feedReadingChange(sent, reading))
          sent = reading
        })
      }),
    ),
    sessionFeedRefresh: t.procedure
      .input(inputSchema)
      .output(refreshOutputSchema)
      .mutation(({ input }) => ({ accepted: readers.refresh(input) })),
    sessionFeedOlder: t.procedure
      .input(inputSchema)
      .output(olderOutputSchema)
      .mutation(({ input }) => ({ accepted: readers.loadOlder(input) })),
  }
}
