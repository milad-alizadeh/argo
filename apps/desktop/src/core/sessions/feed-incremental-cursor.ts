// The state an incremental Feed projection carries between polls (#2145): per-file cursors saying
// how far each file's records have already been turned into rows, plus the Tool Call bookkeeping
// that spans records. Split out of feed-incremental.ts, which owns turning open records into rows.
import type { ToolResult } from './tool-feed'
import type { TranscriptFile, TranscriptRecord } from './transcript'

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
export function openRecordsSince(
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

export function advancedCursors(
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

export function updatedResults(records: PositionedRecord[], prior: Map<string, ToolResult>) {
  const results = new Map(prior)
  for (const { record } of records) {
    if (record.kind !== 'message') continue
    for (const result of record.toolResults ?? []) {
      results.set(result.callId, { content: result.content, failed: result.failed })
    }
  }
  return results
}

export function updatedSkillBodies(records: PositionedRecord[], prior: Map<string, string>) {
  const skillBodies = new Map(prior)
  for (const { record } of records) {
    if (record.kind === 'skill-body') skillBodies.set(record.callId, record.text)
  }
  return skillBodies
}

export function updatedPending(
  records: PositionedRecord[],
  prior: Set<string>,
  results: Map<string, ToolResult>,
) {
  const pending = new Set(prior)
  for (const { record } of records) {
    if (record.kind !== 'message' || record.sidechain) continue
    for (const call of record.toolCalls) if (!results.has(call.id)) pending.add(call.id)
  }
  for (const id of pending) if (results.has(id)) pending.delete(id)
  return pending
}
