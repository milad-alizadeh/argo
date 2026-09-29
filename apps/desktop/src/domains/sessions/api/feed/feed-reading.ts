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
const feedEnvelopeSchema = feedReadingSchema.omit({ entries: true })

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
  // The projector checked each entry; an envelope that fails here is a projection bug, not input.
  const { entries, ...envelope } = body
  return {
    ...feedEnvelopeSchema.parse({
      version: 1,
      type: 'session.feed.reading',
      revision,
      pendingQuestionId: pendingQuestion?.id ?? null,
      ...envelope,
    }),
    entries,
  }
}

type FeedEntry = FeedReading['entries'][number]

// A reading told as a change to the one before it: the earlier reading's first `kept` entries,
// then `tail`. A streamed reply then sends its own rows, not the whole Feed.
const feedReadingChangeSchema = feedReadingSchema.omit({ type: true, entries: true }).extend({
  type: z.literal('session.feed.reading-change'),
  baseRevision: z.string().min(1),
  kept: z.number().int().nonnegative(),
  tail: feedReadingSchema.shape.entries,
})
export type FeedReadingChange = z.infer<typeof feedReadingChangeSchema>

// What the Feed subscription sends: the whole first reading, then each later one as a change.
export type FeedReadingMessage = FeedReading | FeedReadingChange

function sameEntry(left: FeedEntry | undefined, right: FeedEntry | undefined): boolean {
  return left?.id === right?.id && left?.revision === right?.revision
}

export function feedReadingChange(previous: FeedReading, next: FeedReading): FeedReadingChange {
  let kept = 0
  while (kept < next.entries.length && sameEntry(previous.entries[kept], next.entries[kept]))
    kept += 1
  const { entries, ...envelope } = next
  return {
    ...envelope,
    type: 'session.feed.reading-change',
    baseRevision: previous.revision,
    kept,
    tail: entries.slice(kept),
  }
}

// The reading a message makes of the one the reader holds; null when a change was made against
// a reading the reader does not hold, so the reader subscribes again for a whole one.
export function applyFeedReadingChange(
  previous: FeedReading | undefined,
  message: FeedReadingMessage,
): FeedReading | null {
  switch (message.type) {
    case 'session.feed.reading':
      return message
    case 'session.feed.reading-change': {
      if (previous?.revision !== message.baseRevision) return null
      const { baseRevision: _baseRevision, kept, tail, ...envelope } = message
      return {
        ...envelope,
        type: 'session.feed.reading',
        entries: [...previous.entries.slice(0, kept), ...tail],
      }
    }
  }
}
