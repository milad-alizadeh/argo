import { z } from 'zod'
import { feedContentSchema } from '../feed-content'
import { sessionLiveEventSchema } from '../session-live-event'
import {
  type LiveActivity,
  liveActivitySchema,
  type SessionFeedRow,
  sessionFeedRowSchema,
} from './feed-rows'
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

// The Feed rows among its entries, without the transient activity row.
export function feedEntryRows(entries: readonly FeedRowEntry[]): SessionFeedRow[] {
  return entries.flatMap(({ row }) => (row.shape === 'activity' ? [] : [row]))
}

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

type ToolCallRow = Extract<SessionFeedRow, { shape: 'tool' }>

function callActivity(call: ToolCallRow): LiveActivity {
  return {
    label: call.label,
    kind: call.kind,
    open: call.status === 'running',
    ...(call.agentDescription === undefined ? {} : { agentDescription: call.agentDescription }),
  }
}

function thoughtActivity(text: string): LiveActivity | null {
  const label = text.trim()
  return label === '' ? null : { label, kind: 'thought', open: true }
}

// A group's calls and thoughts in the order they happened; a thought follows its call.
function groupActivities(group: Extract<SessionFeedRow, { shape: 'tool-group' }>) {
  const last = group.calls.length - 1
  return group.calls.flatMap((call, index) => [
    callActivity(call),
    ...(group.thoughts ?? [])
      .filter((thought) => (thought.afterCallIndex ?? last) === index)
      .map((thought) => thoughtActivity(thought.text)),
  ])
}

function rowActivities(row: SessionFeedRow): (LiveActivity | null)[] {
  if (row.shape === 'tool-group') return groupActivities(row)
  if (row.shape === 'tool') return [callActivity(row)]
  if (row.shape === 'thought') return [thoughtActivity(row.text)]
  return []
}

// The current Turn's latest tool call or readable thought: the one line the Feed and the roster
// both draw. A Turn that has neither says nothing.
function currentActivity(rows: readonly SessionFeedRow[]): LiveActivity | null {
  const turnStart = rows.findLastIndex((row) => row.shape === 'prose' && row.role === 'user')
  let activity: LiveActivity | null = null
  for (const row of rows.slice(turnStart + 1))
    for (const step of rowActivities(row)) if (step !== null) activity = step
  return activity
}

// The complete ordered rows of one Feed from recorded history and live events, then any `end`
// rows another Feed recorded for it, with settled tool runs grouped and the current activity
// last. Unrecognised input and a repeated row id are skipped and counted, never drawn.
export function projectFeedRowEntries(input: {
  history: readonly unknown[]
  live: readonly unknown[]
  end?: readonly SessionFeedRow[]
}): { entries: FeedRowEntry[]; activity: LiveActivity | null; rejected: FeedRowRejections } {
  const history = accepted(feedContentSchema, input.history)
  const live = accepted(sessionLiveEventSchema, input.live)
  // Each row is checked before grouping, so one bad call drops alone, not with its run.
  const rows: SessionFeedRow[] = []
  const rowIds = new Set<string>()
  let rejectedRows = 0
  for (const row of [...projectLiveFeedRows(history.values, live.values), ...(input.end ?? [])]) {
    const parsed = sessionFeedRowSchema.safeParse(row)
    if (!parsed.success || rowIds.has(rowKey(parsed.data))) rejectedRows += 1
    else {
      rowIds.add(rowKey(parsed.data))
      rows.push(parsed.data)
    }
  }
  const grouped = foldSettledToolRuns(groupToolRuns(rows))
  const activity = currentActivity(grouped)
  const activityRows =
    activity === null ? [] : [{ shape: 'activity', id: ACTIVITY_ROW_ID, activity }]
  const entries: FeedRowEntry[] = []
  const ids = new Set<string>()
  for (const row of [...grouped, ...activityRows]) {
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
    activity,
    rejected: { history: history.rejected, live: live.rejected, rows: rejectedRows },
  }
}
