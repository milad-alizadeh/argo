import { z } from 'zod'
import { type FeedContent, feedContentSchema } from '../feed-content'
import { type SessionLiveEvent, sessionLiveEventSchema } from '../session-live-event'
import {
  type LiveActivity,
  liveActivitySchema,
  type SessionFeedRow,
  sessionFeedRowSchema,
} from './feed-rows'
import { fingerprint } from './fingerprint'
import {
  historyFeedRows,
  type IndexedRows,
  liveFeed,
  mergeFeedRows,
  rowKey,
} from './live-feed-rows'
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

type FeedRowInput = {
  history: readonly unknown[]
  live: readonly unknown[]
  end?: readonly SessionFeedRow[]
}
type FeedRowProjection = {
  entries: FeedRowEntry[]
  activity: LiveActivity | null
  rejected: FeedRowRejections
}

// Rows up to a boundary no tool run crosses, and what grouping made of them.
type SettledRows = {
  history: IndexedRows
  limit: number
  end: number
  rowIds: ReadonlySet<string>
  grouped: SessionFeedRow[]
  entries: FeedRowEntry[]
  entryIds: ReadonlySet<string>
  rejected: number
}

// A row that ends any tool run before it and folds into no group after it; holds while
// `groupedRowIndexes` runs only over tools and thoughts.
function endsToolRuns(row: SessionFeedRow): boolean {
  return row.shape !== 'tool' && row.shape !== 'thought' && row.shape !== 'tool-group'
}

// Kept rows and entries, skipping and counting a repeat of an id seen here or in `seen`.
class UniqueList<Item> {
  readonly items: Item[] = []
  readonly ids = new Set<string>()
  rejected = 0
  readonly #seen: ReadonlySet<string>

  constructor(seen: ReadonlySet<string> = new Set()) {
    this.#seen = seen
  }

  add(item: Item | null, id: (item: Item) => string): void {
    const key = item === null ? null : id(item)
    if (item === null || key === null || this.ids.has(key) || this.#seen.has(key)) {
      this.rejected += 1
      return
    }
    this.ids.add(key)
    this.items.push(item)
  }
}

// One Feed's projection, read again as its inputs change. Parsed input, history's rows and the
// entries of settled history rows no live event touches are kept, so a text event costs what it
// changed rather than the whole history. Each result equals `projectFeedRowEntries` of the input.
export class FeedRowProjector {
  #history: { input: readonly unknown[]; values: FeedContent[]; rejected: number } | null = null
  #historyRows: { values: FeedContent[]; questions: string; rows: IndexedRows } | null = null
  #settled: SettledRows | null = null
  readonly #live = new WeakMap<object, SessionLiveEvent | null>()
  readonly #rows = new WeakMap<SessionFeedRow, SessionFeedRow | null>()
  readonly #entries = new WeakMap<object, FeedRowEntry | null>()

  project(input: FeedRowInput): FeedRowProjection {
    const history = this.#acceptHistory(input.history)
    const live = this.#acceptLive(input.live)
    const events = liveFeed(live.values)
    const indexed = this.#indexHistory(history.values, events.questionCalls)
    const { rows, settledPrefix } = mergeFeedRows(indexed, events)
    const settled = this.#settle(indexed, rows, settledPrefix)
    // Each row is checked before grouping, so one bad call drops alone, not with its run.
    const tail = new UniqueList<SessionFeedRow>(settled.rowIds)
    for (const row of [...rows.slice(settled.end), ...(input.end ?? [])])
      tail.add(this.#validRow(row), rowKey)
    const grouped = foldSettledToolRuns(groupToolRuns(tail.items))
    const activity = currentActivity([...settled.grouped, ...grouped])
    const activityRows: FeedRow[] =
      activity === null ? [] : [{ shape: 'activity', id: ACTIVITY_ROW_ID, activity }]
    const entries = new UniqueList<FeedRowEntry>(settled.entryIds)
    for (const row of [...grouped, ...activityRows]) entries.add(this.#entry(row), ({ id }) => id)
    return {
      entries: [...settled.entries, ...entries.items],
      activity,
      rejected: {
        history: history.rejected,
        live: live.rejected,
        rows: settled.rejected + tail.rejected + entries.rejected,
      },
    }
  }

  #acceptHistory(input: readonly unknown[]) {
    if (this.#history?.input !== input)
      this.#history = { input, ...accepted(feedContentSchema, input) }
    return this.#history
  }

  #acceptLive(inputs: readonly unknown[]) {
    const values: SessionLiveEvent[] = []
    for (const input of inputs) {
      const value = this.#liveEvent(input)
      if (value !== null) values.push(value)
    }
    return { values, rejected: inputs.length - values.length }
  }

  #liveEvent(input: unknown): SessionLiveEvent | null {
    if (typeof input !== 'object' || input === null)
      return sessionLiveEventSchema.safeParse(input).data ?? null
    if (!this.#live.has(input))
      this.#live.set(input, sessionLiveEventSchema.safeParse(input).data ?? null)
    return this.#live.get(input) ?? null
  }

  #indexHistory(values: FeedContent[], questionCalls: ReadonlySet<string>): IndexedRows {
    const questions = JSON.stringify([...questionCalls])
    const cached = this.#historyRows
    if (cached?.values === values && cached.questions === questions) return cached.rows
    const rows = historyFeedRows(values, questionCalls)
    this.#historyRows = { values, questions, rows }
    return rows
  }

  // The history rows before the first one a live event touches, cut after the last row that
  // ends a tool run, so grouping them never depends on what follows.
  #settle(history: IndexedRows, rows: SessionFeedRow[], limit: number): SettledRows {
    const cached = this.#settled
    if (cached?.history === history && cached.limit === limit) return cached
    const kept = new UniqueList<{ row: SessionFeedRow; at: number; rejectedBefore: number }>()
    for (const [at, row] of rows.slice(0, limit).entries()) {
      const rejectedBefore = kept.rejected
      const valid = this.#validRow(row)
      kept.add(valid === null ? null : { row: valid, at, rejectedBefore }, (item) =>
        rowKey(item.row),
      )
    }
    const cut = kept.items.findLastIndex((item) => endsToolRuns(item.row))
    const last = kept.items[cut]
    const end = last === undefined ? 0 : last.at + 1
    // A live event that touches a row after the cut leaves the settled rows as they were.
    if (cached?.history === history && cached.end === end) {
      this.#settled = { ...cached, limit }
      return this.#settled
    }
    const prefix = kept.items.slice(0, cut + 1).map((item) => item.row)
    const grouped = foldSettledToolRuns(groupToolRuns(prefix))
    const entries = new UniqueList<FeedRowEntry>()
    for (const row of grouped) entries.add(this.#entry(row), ({ id }) => id)
    this.#settled = {
      history,
      limit,
      end,
      rowIds: new Set(prefix.map(rowKey)),
      grouped,
      entries: entries.items,
      entryIds: entries.ids,
      rejected: (last?.rejectedBefore ?? 0) + entries.rejected,
    }
    return this.#settled
  }

  #validRow(row: SessionFeedRow): SessionFeedRow | null {
    if (!this.#rows.has(row)) this.#rows.set(row, sessionFeedRowSchema.safeParse(row).data ?? null)
    return this.#rows.get(row) ?? null
  }

  // The parsed row is canonical: schema key order, so its revision is the same on every read.
  #entry(row: FeedRow): FeedRowEntry | null {
    if (!this.#entries.has(row)) {
      const parsed = feedRowSchema.safeParse(row)
      this.#entries.set(row, parsed.success ? entryOf(parsed.data) : null)
    }
    return this.#entries.get(row) ?? null
  }
}

// The complete ordered rows of one Feed from recorded history and live events, then any `end`
// rows another Feed recorded for it, with settled tool runs grouped and the current activity
// last. Unrecognised input and a repeated row id are skipped and counted, never drawn.
export function projectFeedRowEntries(input: FeedRowInput): FeedRowProjection {
  return new FeedRowProjector().project(input)
}
