import type { SessionChain } from './chains'
import { type SessionFeedRow, UNREADABLE_ROW, unreadableRowHeight } from './models'
import { groupToolRuns, type ToolResult, toolRows } from './tool-feed'
import type { TranscriptRecord } from './transcript'

export { UNREADABLE_ROW, unreadableRowHeight }

// The renderer measures a complete projected document, so the revision includes every visible
// field rather than only row ids: a streaming writer can extend a row it already opened. This is
// the exact projection, not a hash: skipped layout can never reuse a collision's geometry.
export function feedProjection(rows: readonly SessionFeedRow[]): string {
  return JSON.stringify(rows)
}

export function rowsOfRecord(
  record: TranscriptRecord,
  position: string,
  results: Map<string, ToolResult>,
): SessionFeedRow[] {
  if (record.kind === 'unreadable') return [{ shape: 'unreadable', id: `unreadable:${position}` }]
  if (record.kind === 'compaction')
    return [{ shape: 'marker', id: `${record.uuid}:compacted`, marker: 'compacted' }]
  if (record.kind === 'command-output')
    return [{ shape: 'command-output', id: record.uuid, text: record.text }]
  // A subagent's turn is not this Session's history. The CLI nests it; Argo leaves it out rather
  // than drawing another agent's work as the reader's own (see `chainMessages`).
  if (record.kind !== 'message' || record.sidechain) return []
  const calls = new Map(record.toolCalls.map((call) => [call.id, call] as const))
  return record.blocks.flatMap((block, index): SessionFeedRow[] => {
    const id = `${record.uuid}:${index}`
    if (block.shape === 'prose')
      return [{ shape: 'prose', id, role: record.role, text: block.text }]
    if (block.shape === 'thought') return [{ shape: 'thought', id, text: block.text }]
    if (block.shape === 'marker') return [{ shape: 'marker', id, marker: block.marker }]
    if (block.shape === 'tool') {
      const call = calls.get(block.callId)
      return call === undefined ? [] : toolRows([call], results)
    }
    return [{ shape: 'source', id, role: record.role, label: block.label, source: block.source }]
  })
}

// A run of damaged lines is one break in the history, not one per line. The transcript can hold
// dozens in a row, and a row each turns a Feed into a wall of the same sentence, which says no more
// than the first one does (#1907). So consecutive damaged lines are drawn as a single row; the
// count is deliberately not said, because a reader can do nothing with it.
export function withoutRepeatedBreaks(rows: SessionFeedRow[]): SessionFeedRow[] {
  return rows.filter(
    (row, index) => row.shape !== 'unreadable' || rows[index - 1]?.shape !== 'unreadable',
  )
}

export function projectFeed(chain: SessionChain): SessionFeedRow[] {
  const results = new Map(
    chain.files
      .flatMap((file) =>
        file.records.flatMap((record) =>
          record.kind === 'message' ? (record.toolResults ?? []) : [],
        ),
      )
      .map(
        (result) => [result.callId, { content: result.content, failed: result.failed }] as const,
      ),
  )
  return groupToolRuns(
    withoutRepeatedBreaks(
      chain.files.flatMap((file, fileIndex) =>
        file.records.flatMap((record, recordIndex) =>
          rowsOfRecord(record, `${fileIndex}:${recordIndex}`, results),
        ),
      ),
    ),
  )
}
