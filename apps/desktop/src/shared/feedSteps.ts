import type { ToolCall, ToolCallKind, ToolCallStatus } from './runtimeTree'

// What a tool row is worth to the NAVIGATION list beside the feed — one entry per row — and the quiet
// fold's own tally, which is the one row whose entry cannot be read off a single call.
//
// Split from `feedCalls.ts`'s loud/quiet policy because this is a different question from the fold: the
// fold decides what is worth a ROW, and this decides what that row is called in a list. They are derived
// in one pass all the same (`ToolRowPair`), which is what keeps the two panes from disagreeing.

/** One kind's tally inside a folded run, in Argo's own vocabulary. A count rather than a sentence
 * because a sentence degrades into "read a file, read a file, read a file" at thirty calls. */
export interface QuietCount {
  word: string
  count: number
}

/** A run of consecutive observation, folded to one line. */
export interface QuietRowModel {
  kind: 'quiet'
  key: string
  counts: readonly QuietCount[]
}

/** What a folded run reads as, in one place: `read 3 · searched 1`. The navigation list and the feed
 * row both spell it from here, because two spellings of one tally are two facts to keep true. */
export const quietLabel = (counts: readonly QuietCount[]): string =>
  counts.map(({ word, count }) => `${word} ${count}`).join(' · ')

export const isRunning = (status: ToolCallStatus): boolean =>
  status === 'pending' || status === 'in_progress'

/** The word a kind wears in a fold. The kind's own word where it already reads as one, so only the
 * two that would read as nouns are spelled out. */
const QUIET_WORD: Partial<Record<ToolCallKind, string>> = { search: 'searched', fetch: 'fetched' }

/** The tallies of one run, in the order the kinds first appeared — which is the order the work
 * happened in, and the only order that does not need explaining. */
export function quietRow(run: readonly ToolCall[]): QuietRowModel {
  const byKind = new Map<ToolCallKind, number>()
  for (const call of run) byKind.set(call.kind, (byKind.get(call.kind) ?? 0) + 1)
  return {
    kind: 'quiet',
    key: `quiet:${run[0]?.id ?? ''}`,
    counts: [...byKind].map(([kind, count]) => ({ word: QUIET_WORD[kind] ?? kind, count })),
  }
}

/**
 * What one tool row is worth to the navigation list: one entry, naming the same row.
 *
 * It carries the ROW's own key, which is the anchor the feed hangs on that row — so a folded run of
 * twelve reads is one entry pointing at one anchor, rather than a list of twelve steps beside a feed
 * that draws them as a single line (issue 319).
 */
export interface ToolRowStep {
  key: string
  /** The host's own tool name for a single call, and Argo's tally for a folded run. */
  name: string
  target: string | null
  status: ToolCallStatus
  /** Raw times, not formatted: the clock's vocabulary is the renderer's, and this layer holds no
   * locale. `null` where the record carried none. */
  atMs: number | null
  endedAtMs: number | null
}

/** The entry for a row that stands for ONE call: the host's own name and target, and the call's own
 * clock. Takes the row's key rather than the row, so the fold's union does not have to travel here. */
export const callStep = (row: { key: string }, call: ToolCall): ToolRowStep => ({
  key: row.key,
  name: call.name,
  target: call.target,
  status: call.status,
  atMs: call.atMs,
  endedAtMs: call.endedAtMs,
})

/** The entry for a folded run: the tally as its name, and the run's own span — from the first call's
 * clock to the last one's end. A run with anything still going reads as running, since a fold reporting
 * `completed` while one of its reads was outstanding would be a false DIRECT. */
export const quietStep = (row: QuietRowModel, run: readonly ToolCall[]): ToolRowStep => ({
  key: row.key,
  name: quietLabel(row.counts),
  // No target: a run of twelve reads has twelve of them, and naming the first would say the other
  // eleven were something else.
  target: null,
  status: run.some((call) => isRunning(call.status)) ? 'in_progress' : 'completed',
  atMs: run[0]?.atMs ?? null,
  endedAtMs: run.at(-1)?.endedAtMs ?? null,
})
