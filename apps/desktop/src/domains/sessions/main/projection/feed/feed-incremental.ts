// Projecting a Feed while a Harness keeps appending to it (#2145): a poll runs `rowsOfRecord` over
// the records the last poll already turned into rows only when it must. A row freezes once
// nothing later in the chain can still change it — every Tool Call it draws has a result, and it
// is not part of a trailing Tool Call or damaged-line run. Frozen rows are never rebuilt.
import type { SessionFeedRow } from '@/domains/sessions/contract/model/feed/feed-rows'
import type { ToolEvidence, ToolResult } from '@/domains/sessions/contract/model/feed/tool-feed'
import {
  groupedRowIndexes,
  groupToolRuns,
} from '@/domains/sessions/contract/model/feed/tool-groups'
import type { SessionChain } from '@/domains/sessions/contract/model/transcript/chains'
import type {
  TranscriptFile,
  TranscriptRecord,
} from '@/domains/sessions/contract/model/transcript/transcript'
import { collectFeedRows, rowsOfRecord, withoutRepeatedBreaks } from './feed'

export type PositionedRecord = { record: TranscriptRecord; position: string; fileIndex: number }

export type FileCursor = { path: string; count: number; lastRecord: TranscriptRecord | undefined }

// Everything past one file's held cursor: `null` when the file was cut shorter or rewritten in
// place — only a fresh projection, the file treated as unheld, can recover from either.
function openRecordsInFile(
  file: TranscriptFile,
  fileIndex: number,
  cursor: FileCursor | undefined,
): { records: PositionedRecord[]; cursor: FileCursor } | null {
  if (cursor !== undefined && cursor.path !== file.path) return null
  const count = cursor?.count ?? 0
  if (file.records.length < count) return null
  if (count > 0 && file.records[count - 1] !== cursor?.lastRecord) return null
  const records: PositionedRecord[] = []
  for (let recordIndex = count; recordIndex < file.records.length; recordIndex += 1) {
    const record = file.records[recordIndex]
    if (record !== undefined)
      records.push({ record, position: `${fileIndex}:${recordIndex}`, fileIndex })
  }
  // The record just before the cursor, not the file's actual last record: a poll that advances no
  // further here (a trailing Tool Call still pending, say) must see the same `lastRecord` next
  // time, or the next call's invariant check reads it as a rewrite and resets everything.
  const nextCursor = {
    path: file.path,
    count,
    lastRecord: count > 0 ? file.records[count - 1] : undefined,
  }
  return { records, cursor: nextCursor }
}

// Everything past the held cursors, file by file: `null` when a file was cut shorter or rewritten
// in place, or the chain gained, lost or reordered a file (a later Roster pass reads the true
// origin of a chain this cache first saw as a resumed half) — only a fresh projection, every file
// treated as unheld, can recover from any of those.
function openFilesSince(
  files: readonly TranscriptFile[],
  heldFiles: readonly FileCursor[],
): { records: PositionedRecord[]; cursors: FileCursor[] } | null {
  const records: PositionedRecord[] = []
  const cursors: FileCursor[] = []
  for (const [fileIndex, file] of files.entries()) {
    const open = openRecordsInFile(file, fileIndex, heldFiles[fileIndex])
    if (open === null) return null
    records.push(...open.records)
    cursors.push(open.cursor)
  }
  return { records, cursors }
}

function advancedCursors(
  cursors: FileCursor[],
  records: PositionedRecord[],
  safeCount: number,
): FileCursor[] {
  const advanced = [...cursors]
  for (let index = 0; index < safeCount; index += 1) {
    const positioned = records[index]
    if (positioned === undefined) continue
    const current = advanced[positioned.fileIndex]
    if (current === undefined) continue
    advanced[positioned.fileIndex] = {
      ...current,
      count: current.count + 1,
      lastRecord: positioned.record,
    }
  }
  return advanced
}

// A background command's end lands on the receipt its call already holds.
function endBackgroundCall(record: TranscriptRecord, results: Map<string, ToolResult>) {
  if (record.kind !== 'background-task') return
  const receipt = results.get(record.callId)
  if (receipt !== undefined) results.set(record.callId, { ...receipt, ended: record.state })
}

function updatedResults(records: PositionedRecord[], prior: Map<string, ToolResult>) {
  const results = new Map(prior)
  for (const { record } of records) {
    endBackgroundCall(record, results)
    if (record.kind !== 'message') continue
    for (const result of record.toolResults ?? []) {
      results.set(result.callId, {
        blocks: result.blocks,
        failed: result.failed,
        ...(result.background === undefined ? {} : { background: true }),
      })
    }
  }
  return results
}

function updatedSkillBodies(records: PositionedRecord[], prior: Map<string, string>) {
  const skillBodies = new Map(prior)
  for (const { record } of records) {
    if (record.kind === 'skill-body') skillBodies.set(record.callId, record.text)
  }
  return skillBodies
}

// A call with no result is open, and so is a background one whose receipt is all that came back.
function isOpen(result: ToolResult | undefined) {
  return result === undefined || (result.background === true && result.ended === undefined)
}

function updatedPending(
  records: PositionedRecord[],
  prior: Set<string>,
  results: Map<string, ToolResult>,
) {
  const pending = new Set(prior)
  for (const { record } of records) {
    if (record.kind !== 'message' || record.sidechain) continue
    for (const call of record.toolCalls) if (isOpen(results.get(call.id))) pending.add(call.id)
  }
  for (const id of pending) if (!isOpen(results.get(id))) pending.delete(id)
  return pending
}

export type FeedProjectionState = {
  chainId: string
  files: FileCursor[]
  frozenRows: SessionFeedRow[]
  results: Map<string, ToolResult>
  skillBodies: Map<string, string>
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
function positionedRows(records: PositionedRecord[], evidence: ToolEvidence) {
  const projected = records.map(({ record, position }) => ({
    record,
    rows: rowsOfRecord(record, position, evidence),
  }))
  const { rows, breakBeforeIds } = collectFeedRows(projected)
  const sources = projected.flatMap(({ rows }, source) => rows.map(() => source))
  return { rows, sources, breakBeforeIds }
}

function mergedRows(records: PositionedRecord[], evidence: ToolEvidence) {
  const { rows: preRows, sources: preSources, breakBeforeIds } = positionedRows(records, evidence)
  const deduped = withoutRepeatedBreaks(preRows)
  const dedupedSources = preRows.flatMap((row, index) =>
    row.shape !== 'unreadable' || preRows[index - 1]?.shape !== 'unreadable'
      ? [preSources[index]]
      : [],
  )
  const grouped = groupToolRuns(deduped, breakBeforeIds)
  const groups = groupedRowIndexes(deduped, breakBeforeIds)
  const groupedSources = groups.map((group) =>
    Math.min(...group.map((index) => dedupedSources[index] ?? Number.POSITIVE_INFINITY)),
  )
  const sourcesByRowId = new Map(
    grouped.map((row, index) => [row.id, groupedSources[index] ?? 0] as const),
  )
  return grouped.map((row) => ({ row, source: sourcesByRowId.get(row.id) ?? 0 }))
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
export function projectFeed(
  chain: SessionChain,
  state: FeedProjectionState | undefined,
): { rows: SessionFeedRow[]; previouslyFrozenCount: number; state: FeedProjectionState } {
  const previouslyFrozenCount = state?.chainId === chain.id ? state.frozenRows.length : 0
  const open = openRecordsSince(chain, state)
  if (open === null) return projectFeed(chain, undefined)
  const { records, cursors } = open
  const frozenRows = state?.chainId === chain.id ? state.frozenRows : []
  if (records.length === 0) {
    const settled: FeedProjectionState = {
      chainId: chain.id,
      files: cursors,
      frozenRows,
      results: state?.results ?? new Map(),
      skillBodies: state?.skillBodies ?? new Map(),
      pending: state?.pending ?? new Set(),
    }
    return { rows: frozenRows, previouslyFrozenCount, state: settled }
  }
  const results = updatedResults(records, state?.results ?? new Map())
  const skillBodies = updatedSkillBodies(records, state?.skillBodies ?? new Map())
  const pending = updatedPending(records, state?.pending ?? new Set(), results)
  const openRows = mergedRows(records, { results, skillBodies })
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
    skillBodies,
    pending,
  }
  return {
    rows: [...newFrozenRows, ...openRows.slice(safeRowCount).map((entry) => entry.row)],
    previouslyFrozenCount,
    state: nextState,
  }
}
