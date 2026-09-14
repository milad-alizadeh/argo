// Projecting a Feed while a CLI keeps appending to it (#2145): a poll runs `rowsOfRecord` over
// the records the last poll already turned into rows only when it must. A row freezes once
// nothing later in the chain can still change it — every Tool Call it draws has a result, and it
// is not part of a Tool Call run or a run of damaged lines still touching the end of the chain —
// and a frozen row is never rebuilt. What is not frozen is rebuilt from its own records each
// poll, which is why an unresolved Tool Call near the start of a long chain can hold the cost up:
// correct before fast, and the CLIs resolve a call within a message or two in practice.
import type { SessionChain } from './chains'
import { rowsOfRecord, withoutRepeatedBreaks } from './feed'
import {
  advancedCursors,
  type FileCursor,
  openRecordsSince as openFilesSince,
  type PositionedRecord,
  updatedPending,
  updatedResults,
} from './feed-incremental-cursor'
import type { SessionFeedRow } from './models'
import { groupToolRuns, type ToolResult } from './tool-feed'

export type FeedProjectionState = {
  chainId: string
  files: FileCursor[]
  frozenRows: SessionFeedRow[]
  results: Map<string, ToolResult>
  pending: Set<string>
}

// Everything past the held cursors: `null` when the chain no longer matches what was held (a
// file cut shorter or rewritten in place, or gained, lost or reordered), in which case a fresh
// projection, every file treated as unheld, is the only way to recover.
function openRecordsSince(chain: SessionChain, state: FeedProjectionState | undefined) {
  const held = state?.chainId === chain.id ? state.files : []
  return openFilesSince(chain.files, held)
}

// The pre-merge row list for the open records, each tagged with the 0-based index (into
// `records`) of the record that drew it, so freezing can tell which records a frozen row covers.
function positionedRows(records: PositionedRecord[], results: Map<string, ToolResult>) {
  const rows: SessionFeedRow[] = []
  const sources: number[] = []
  records.forEach(({ record, position }, source) => {
    for (const row of rowsOfRecord(record, position, results)) {
      rows.push(row)
      sources.push(source)
    }
  })
  return { rows, sources }
}

// `groupToolRuns` and `withoutRepeatedBreaks` merge runs of matching shape; this walks the same
// runs, purely by shape, to say which pre-merge rows (by their source) fold into each output row.
function mergedRunSources(shapes: readonly string[], mergeable: string): number[][] {
  const groups: number[][] = []
  let index = 0
  while (index < shapes.length) {
    if (shapes[index] !== mergeable) {
      groups.push([index])
      index += 1
      continue
    }
    const run: number[] = []
    while (shapes[index] === mergeable) {
      run.push(index)
      index += 1
    }
    groups.push(run)
  }
  return groups
}

function mergedRows(records: PositionedRecord[], results: Map<string, ToolResult>) {
  const { rows: preRows, sources: preSources } = positionedRows(records, results)
  const deduped = withoutRepeatedBreaks(preRows)
  const dedupedSources = preRows.flatMap((row, index) =>
    row.shape !== 'unreadable' || preRows[index - 1]?.shape !== 'unreadable'
      ? [preSources[index]]
      : [],
  )
  const grouped = groupToolRuns(deduped)
  const groups = mergedRunSources(
    deduped.map((row) => row.shape),
    'tool',
  )
  const groupedSources = groups.map((group) =>
    Math.min(...group.map((index) => dedupedSources[index] ?? Number.POSITIVE_INFINITY)),
  )
  return grouped.map((row, index) => ({ row, source: groupedSources[index] ?? 0 }))
}

// Everything is safe to freeze except a Tool Call still missing a result, and a trailing run of
// Tool or unreadable rows: the next poll's new record could still extend either. Returns the index
// (into `records`) of the earliest record that is not yet safe to freeze.
function firstUnfrozenRecordIndex(
  rows: { row: SessionFeedRow; source: number }[],
  records: PositionedRecord[],
  pending: Set<string>,
): number {
  let firstUnfrozen = records.length
  const last = rows.at(-1)
  const trailing =
    last?.row.shape === 'tool' ||
    last?.row.shape === 'tool-group' ||
    last?.row.shape === 'unreadable'
  if (last !== undefined && trailing) firstUnfrozen = Math.min(firstUnfrozen, last.source)
  records.forEach(({ record }, source) => {
    if (record.kind !== 'message' || record.sidechain) return
    if (record.toolCalls.some((call) => pending.has(call.id)))
      firstUnfrozen = Math.min(firstUnfrozen, source)
  })
  return firstUnfrozen
}

// The Feed for one chain, reusing as much of the last poll's work as it safely can. Pass the
// state the previous call returned; pass none for the first poll of a chain.
export function projectFeedIncrementally(
  chain: SessionChain,
  state: FeedProjectionState | undefined,
): { rows: SessionFeedRow[]; previouslyFrozenCount: number; state: FeedProjectionState } {
  const previouslyFrozenCount = state?.chainId === chain.id ? state.frozenRows.length : 0
  const open = openRecordsSince(chain, state)
  if (open === null) return projectFeedIncrementally(chain, undefined)
  const { records, cursors } = open
  const frozenRows = state?.chainId === chain.id ? state.frozenRows : []
  if (records.length === 0) {
    const settled: FeedProjectionState = {
      chainId: chain.id,
      files: cursors,
      frozenRows,
      results: state?.results ?? new Map(),
      pending: state?.pending ?? new Set(),
    }
    return { rows: frozenRows, previouslyFrozenCount, state: settled }
  }
  const results = updatedResults(records, state?.results ?? new Map())
  const pending = updatedPending(records, state?.pending ?? new Set(), results)
  const openRows = mergedRows(records, results)
  const firstUnfrozen = firstUnfrozenRecordIndex(openRows, records, pending)
  const safeRowCount = openRows.filter((entry) => entry.source < firstUnfrozen).length
  const newFrozenRows = [
    ...frozenRows,
    ...openRows.slice(0, safeRowCount).map((entry) => entry.row),
  ]
  const nextState: FeedProjectionState = {
    chainId: chain.id,
    files: advancedCursors(cursors, records, firstUnfrozen),
    frozenRows: newFrozenRows,
    results,
    pending,
  }
  return {
    rows: [...newFrozenRows, ...openRows.slice(safeRowCount).map((entry) => entry.row)],
    previouslyFrozenCount,
    state: nextState,
  }
}
