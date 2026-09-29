import { z } from 'zod'
import { sessionErrorSchema } from '@/domains/sessions/api/session-error'
import { sessionLiveStatusSchema } from '@/domains/sessions/api/session-live-event'
import { identifierSchema } from '@/shared/validation'
import { feedRowEntrySchema } from './feed-row-entries'
import { feedSubagentSchema } from './feed-subagents'
import { fingerprint } from './fingerprint'

const FEED_READ_STATES = ['loading', 'ready', 'failed'] as const

// One complete Feed as main last read it: every row in order, and how its latest read went.
const feedReadingSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.feed.reading'),
  sessionId: identifierSchema,
  chainId: identifierSchema,
  revision: z.string().min(1),
  state: z.enum(FEED_READ_STATES),
  // Why the latest read failed; the rows it had before stay in `entries`.
  error: sessionErrorSchema.nullable(),
  pendingQuestionId: identifierSchema.nullable(),
  // The live Permission request still waiting on a decision, so the reader reads its details.
  pendingPermissionId: identifierSchema.nullable(),
  // The latest status the live channel reported; null when it reported none.
  liveStatus: sessionLiveStatusSchema.nullable(),
  entries: z.array(feedRowEntrySchema),
  // The Subagents this Feed's rows name; empty for a Subagent's own Feed.
  subagents: z.array(feedSubagentSchema),
})
export type FeedReading = z.infer<typeof feedReadingSchema>

export function feedReading(
  body: Omit<FeedReading, 'version' | 'type' | 'revision' | 'pendingQuestionId'>,
): FeedReading {
  const pendingQuestion = body.entries
    .map(({ row }) => row)
    .find((row) => row.shape === 'ask' && row.answer === null)
  const revision = fingerprint(
    JSON.stringify([
      body.state,
      body.error?.code ?? null,
      body.pendingPermissionId,
      body.liveStatus,
      body.entries.map(({ id, revision }) => [id, revision]),
    ]),
  )
  // Validated before it crosses IPC; a reading that fails here is a projection bug, not input.
  return feedReadingSchema.parse({
    version: 1,
    type: 'session.feed.reading',
    revision,
    pendingQuestionId: pendingQuestion?.id ?? null,
    ...body,
  })
}
