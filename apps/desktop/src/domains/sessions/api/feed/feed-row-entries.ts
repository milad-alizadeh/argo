import { z } from 'zod'
import { feedContentSchema } from '@/domains/sessions/api/feed-content'
import { sessionLiveEventSchema } from '@/domains/sessions/api/session-live-event'
import { liveActivitySchema, type SessionFeedRow, sessionFeedRowSchema } from './feed-rows'
import { fingerprint } from './fingerprint'
import { projectLiveFeedRows, rowKey } from './live-feed-rows'
import { foldSettledToolRuns, groupToolRuns } from './tool-groups'

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
export const feedRowEntrySchema = z.strictObject({
  id: z.string().min(1),
  revision: z.string().min(1),
  row: feedRowSchema,
})
type FeedRowEntry = z.infer<typeof feedRowEntrySchema>

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

// The complete ordered rows of one Feed from recorded history and live events, with settled tool
// runs grouped. Unrecognised input and a repeated row id are skipped and counted, never drawn.
export function projectFeedRowEntries(input: {
  history: readonly unknown[]
  live: readonly unknown[]
  activity: z.infer<typeof liveActivitySchema> | null
}): { entries: FeedRowEntry[]; rejected: FeedRowRejections } {
  const history = accepted(feedContentSchema, input.history)
  const live = accepted(sessionLiveEventSchema, input.live)
  // Each row is checked before grouping, so one bad call drops alone, not with its run.
  const rows: SessionFeedRow[] = []
  const rowIds = new Set<string>()
  let rejectedRows = 0
  for (const row of projectLiveFeedRows(history.values, live.values)) {
    const parsed = sessionFeedRowSchema.safeParse(row)
    if (!parsed.success || rowIds.has(rowKey(parsed.data))) rejectedRows += 1
    else {
      rowIds.add(rowKey(parsed.data))
      rows.push(parsed.data)
    }
  }
  const activity =
    input.activity === null
      ? []
      : [{ shape: 'activity', id: ACTIVITY_ROW_ID, activity: input.activity }]
  const entries: FeedRowEntry[] = []
  const ids = new Set<string>()
  for (const row of [...foldSettledToolRuns(groupToolRuns(rows)), ...activity]) {
    // The parsed row is canonical: schema key order, so its revision is the same on every read.
    const parsed = feedRowSchema.safeParse(row)
    const entry = parsed.success ? entryOf(parsed.data) : null
    if (entry === null || ids.has(entry.id)) rejectedRows += 1
    else {
      ids.add(entry.id)
      entries.push(entry)
    }
  }
  return {
    entries,
    rejected: { history: history.rejected, live: live.rejected, rows: rejectedRows },
  }
}
