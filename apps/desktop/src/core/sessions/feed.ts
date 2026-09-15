import type { SessionChain } from './chains'
import { groupDelegations } from './delegation-groups'
import { type SessionFeedRow, UNREADABLE_ROW, unreadableRowHeight } from './models'
import { type ToolResult, toolRows } from './tool-feed'
import { groupToolRuns } from './tool-groups'
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
  if (record.kind === 'event')
    return [{ shape: 'event', id: record.uuid, event: record.event, text: record.text }]
  if (record.kind === 'delegation')
    return [
      {
        shape: 'delegation',
        id: record.uuid,
        actor: record.actor,
        action: record.action,
        status: record.status,
        progress: record.progress,
        groupId: record.groupId,
      },
    ]
  // A subagent's turn is not this Session's history. The CLI nests it; Argo leaves it out rather
  // than drawing another agent's work as the reader's own (see `chainMessages`).
  if (record.kind !== 'message' || record.sidechain) return []
  const calls = new Map(record.toolCalls.map((call) => [call.id, call] as const))
  const rows = record.blocks.flatMap((block, index): SessionFeedRow[] => {
    const id = `${record.uuid}:${index}`
    if (block.shape === 'prose')
      return [{ shape: 'prose', id, role: record.role, text: block.text }]
    if (block.shape === 'thought') return [{ shape: 'thought', id, text: block.text }]
    if (block.shape === 'marker') return [{ shape: 'marker', id, marker: block.marker }]
    if (block.shape === 'event')
      return [{ shape: 'event', id, event: block.event, text: block.text }]
    if (block.shape === 'tool') {
      const call = calls.get(block.callId)
      return call === undefined ? [] : toolRows([call], results)
    }
    return [{ shape: 'source', id, role: record.role, label: block.label, source: block.source }]
  })
  return rows
}

// Tool results are deliberately silent in the Feed: they fill in the Tool Call that already drew
// the command. Other silent messages are deliveries in their own right, so they close a Tool run
// even though nothing from them is shown.
export function isHiddenToolRunBoundary(record: TranscriptRecord, rows: SessionFeedRow[]) {
  return (
    rows.length === 0 &&
    ((record.kind === 'message' && (record.sidechain || (record.toolResults?.length ?? 0) === 0)) ||
      (record.kind === 'trace' && record.boundary === true))
  )
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
  const rows: SessionFeedRow[] = []
  const breakBeforeIds = new Set<string>()
  let hiddenDelivery = false
  for (const [fileIndex, file] of chain.files.entries()) {
    for (const [recordIndex, record] of file.records.entries()) {
      const recordRows = rowsOfRecord(record, `${fileIndex}:${recordIndex}`, results)
      if (isHiddenToolRunBoundary(record, recordRows)) {
        hiddenDelivery = true
        continue
      }
      if (recordRows.length === 0) continue
      if (hiddenDelivery) breakBeforeIds.add(recordRows[0]?.id ?? '')
      hiddenDelivery = false
      rows.push(...recordRows)
    }
  }
  return groupDelegations(groupToolRuns(withoutRepeatedBreaks(rows), breakBeforeIds))
}
