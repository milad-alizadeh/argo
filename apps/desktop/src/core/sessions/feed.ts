import type { SessionChain } from './chains'
import { groupDelegations } from './delegation-groups'
import { type SessionFeedRow, UNREADABLE_ROW, unreadableRowHeight } from './models'
import { withPromptAttachments } from './prompt-attachments'
import { type ToolEvidence, toolRows } from './tool-feed'
import { groupToolRuns } from './tool-groups'
import type { ContentBlock, ToolCall, TranscriptMessage, TranscriptRecord } from './transcript'

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
  evidence: ToolEvidence,
): SessionFeedRow[] {
  if (record.kind === 'unreadable') return [{ shape: 'unreadable', id: `unreadable:${position}` }]
  if (record.kind === 'compaction')
    return [
      {
        shape: 'marker',
        id: `${record.uuid}:compacted`,
        marker: 'compacted',
        summary: record.summary ?? null,
      },
    ]
  if (record.kind === 'command-output')
    return [{ shape: 'command-output', id: record.uuid, text: record.text }]
  if (record.kind === 'event')
    return [{ shape: 'event', id: record.uuid, event: record.event, text: record.text, raw: null }]
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
        callId: record.callId,
      },
    ]
  // A subagent's turn is not this Session's history. The CLI nests it; Argo leaves it out rather
  // than drawing another agent's work as the reader's own (see `chainMessages`).
  if (record.kind !== 'message' || record.sidechain) return []
  const calls = new Map(record.toolCalls.map((call) => [call.id, call] as const))
  const rows = record.blocks.flatMap((block, index) =>
    rowsOfBlock({ block, id: `${record.uuid}:${index}`, record, calls, evidence }),
  )
  return withPromptAttachments(rows, record)
}

function rowsOfBlock({
  block,
  id,
  record,
  calls,
  evidence,
}: {
  block: ContentBlock
  id: string
  record: TranscriptMessage
  calls: Map<string, ToolCall>
  evidence: ToolEvidence
}): SessionFeedRow[] {
  switch (block.shape) {
    case 'prose':
      return [{ shape: 'prose', id, role: record.role, text: block.text }]
    // An empty thinking block (redacted or summarized away by the API) draws nothing, so it must
    // not count as a delivery either, or it silently splits a tool run across it (#2100).
    case 'thought':
      return block.text.trim() === '' ? [] : [{ shape: 'thought', id, text: block.text }]
    case 'marker':
      return [{ shape: 'marker', id, marker: block.marker, summary: null }]
    case 'event':
      return [{ shape: 'event', id, event: block.event, text: block.text, raw: block.raw ?? null }]
    case 'tool': {
      const call = calls.get(block.callId)
      return call === undefined ? [] : toolRows([call], evidence)
    }
    // A prompt's attachments are drawn in its bubble by `withPromptAttachments`.
    case 'file':
      return []
    case 'image':
      return record.role === 'user'
        ? []
        : [{ shape: 'source', id, role: record.role, label: 'image', source: block.url }]
    case 'source':
      return [{ shape: 'source', id, role: record.role, label: block.label, source: block.source }]
  }
}

// Tool results, and an assistant message left with nothing to show (an empty or redacted
// thinking block), are deliberately silent in the Feed: they carry no delivery of their own, so
// a Tool run spanning them merges. A sidechain message is a subagent's own turn (see
// `rowsOfRecord`, which already drops its rows), a real delivery this Session never made, so a
// Tool run must not read across it.
export function isHiddenToolRunBoundary(record: TranscriptRecord, rows: SessionFeedRow[]) {
  return (
    rows.length === 0 &&
    ((record.kind === 'message' && record.sidechain) ||
      (record.kind === 'trace' && record.boundary === true))
  )
}

export function collectFeedRows(records: { record: TranscriptRecord; rows: SessionFeedRow[] }[]) {
  const rows: SessionFeedRow[] = []
  const breakBeforeIds = new Set<string>()
  let hiddenDelivery = false
  for (const projected of records) {
    if (isHiddenToolRunBoundary(projected.record, projected.rows)) {
      hiddenDelivery = true
      continue
    }
    if (projected.rows.length === 0) continue
    if (hiddenDelivery) breakBeforeIds.add(projected.rows[0]?.id ?? '')
    hiddenDelivery = false
    rows.push(...projected.rows)
  }
  return { rows, breakBeforeIds }
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
  const skillBodies = new Map(
    chain.files.flatMap((file) =>
      file.records.flatMap((record) =>
        record.kind === 'skill-body' ? [[record.callId, record.text] as const] : [],
      ),
    ),
  )
  const projected = chain.files.flatMap((file, fileIndex) =>
    file.records.map((record, recordIndex) => ({
      record,
      rows: rowsOfRecord(record, `${fileIndex}:${recordIndex}`, { results, skillBodies }),
    })),
  )
  const { rows, breakBeforeIds } = collectFeedRows(projected)
  return groupDelegations(groupToolRuns(withoutRepeatedBreaks(rows), breakBeforeIds))
}
