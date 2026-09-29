import { initTRPC } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import { z } from 'zod'
import type { FeedReading } from '@/domains/sessions/api/feed/feed-reading'
import { identifierSchema } from '@/shared/validation'
import { type SessionFeedReaderContext, SessionFeedReaders } from '../feed/feed-reader'

const t = initTRPC.create()
const inputSchema = z.strictObject({ sessionId: identifierSchema })
const refreshOutputSchema = z.strictObject({ accepted: z.boolean() })

// Observe publishes each changed reading of a root Session's Feed; Refresh starts a real read.
export function sessionFeedProcedures(context: SessionFeedReaderContext) {
  const readers = new SessionFeedReaders(context)
  return {
    sessionFeed: t.procedure
      .input(inputSchema)
      .subscription(({ input }) =>
        observable<FeedReading>((emit) =>
          readers.observe(input.sessionId, (reading) => emit.next(reading)),
        ),
      ),
    sessionFeedRefresh: t.procedure
      .input(inputSchema)
      .output(refreshOutputSchema)
      .mutation(({ input }) => ({ accepted: readers.refresh(input.sessionId) })),
  }
}
