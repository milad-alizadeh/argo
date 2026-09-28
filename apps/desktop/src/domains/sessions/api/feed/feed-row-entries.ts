import { z } from 'zod'
import { feedContentSchema } from '@/domains/sessions/api/feed-content'
import { sessionLiveEventSchema } from '@/domains/sessions/api/session-live-event'
import { liveActivitySchema, sessionFeedRowSchema } from './feed-rows'
import { fingerprint } from './fingerprint'
import { projectLiveFeedRows, rowKey } from './live-feed-rows'

const ACTIVITY_ROW_ID = 'activity'

// What the Session is doing now: transient, never in history, and at most one per Feed.
const activityRowSchema = z.strictObject({
  shape: z.literal('activity'),
  id: z.literal(ACTIVITY_ROW_ID),
  activity: liveActivitySchema,
})

const feedRowSchema = z.discriminatedUnion('shape', [
  ...sessionFeedRowSchema.options,
  activityRowSchema,
])
type FeedRow = z.infer<typeof feedRowSchema>

function feedRowRevision(row: FeedRow): string {
  return fingerprint(JSON.stringify(row))
}

// `id` is the row's stable identity across reads; `revision` changes when its drawing would.
const feedRowEntrySchema = z.strictObject({
  id: z.string().min(1),
  revision: z.string().min(1),
  row: feedRowSchema,
})
type FeedRowEntry = z.infer<typeof feedRowEntrySchema>

const feedRowEntriesSchema = z.array(feedRowEntrySchema).superRefine((entries, context) => {
  const seen = new Set<string>()
  for (const [index, entry] of entries.entries()) {
    if (seen.has(entry.id))
      context.addIssue({ code: 'custom', path: [index, 'id'], message: 'Duplicate Feed row id.' })
    seen.add(entry.id)
    if (entry.revision !== feedRowRevision(entry.row))
      context.addIssue({ code: 'custom', path: [index, 'revision'], message: 'Stale revision.' })
    if (entry.row.shape === 'activity' && index !== entries.length - 1)
      context.addIssue({ code: 'custom', path: [index], message: 'Activity row must be last.' })
  }
})

type FeedRowRejections = { history: number; live: number; rows: number }

function entryOf(row: FeedRow): FeedRowEntry {
  return {
    id: row.shape === 'activity' ? ACTIVITY_ROW_ID : rowKey(row),
    revision: feedRowRevision(row),
    row,
  }
}

function accepted<Value>(
  schema: z.ZodType<Value>,
  inputs: readonly unknown[],
): { values: Value[]; rejected: number } {
  const values: Value[] = []
  for (const input of inputs) {
    const parsed = schema.safeParse(input)
    if (parsed.success) values.push(parsed.data)
  }
  return { values, rejected: inputs.length - values.length }
}

// The complete ordered rows of one Feed from recorded history and live events. Main can call
// this without a renderer: unrecognised input is skipped and counted, never drawn.
export function projectFeedRowEntries(input: {
  history: readonly unknown[]
  live: readonly unknown[]
  activity: z.infer<typeof liveActivitySchema> | null
}): { entries: FeedRowEntry[]; rejected: FeedRowRejections } {
  const history = accepted(feedContentSchema, input.history)
  const live = accepted(sessionLiveEventSchema, input.live)
  const projected = projectLiveFeedRows(history.values, live.values)
  const entries: FeedRowEntry[] = []
  let rejectedRows = 0
  for (const row of projected) {
    // The parsed row is canonical: schema key order, so its revision is the same on every read.
    const parsed = feedRowSchema.safeParse(row)
    if (parsed.success) entries.push(entryOf(parsed.data))
    else rejectedRows += 1
  }
  if (input.activity !== null)
    entries.push(
      entryOf(
        feedRowSchema.parse({ shape: 'activity', id: ACTIVITY_ROW_ID, activity: input.activity }),
      ),
    )
  return {
    entries: feedRowEntriesSchema.parse(entries),
    rejected: { history: history.rejected, live: live.rejected, rows: rejectedRows },
  }
}
