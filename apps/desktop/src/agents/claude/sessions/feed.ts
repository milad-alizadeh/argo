// Projecting a stitched chain into the rows the Feed draws. Records are transcript lines; rows
// are what the Feed draws, and the two counts differ (ADR-0033 · Context).
import type { SessionChain } from './chains'
import type { TranscriptRecord } from './records'
import type { SessionFeedRow as FeedRow } from '../../../core/sessions/models'

export type { FeedRow }

// The stated height formula for the one row shape Blink does not lay out from content
// (ADR-0033 rule 1). Drawn height is `padding * 2 + lineHeight`, and the packaged proof asserts
// the formula equals the drawn box.
export const UNREADABLE_ROW = { paddingBlock: 8, lineHeight: 20 }

export function unreadableRowHeight(): number {
  return UNREADABLE_ROW.paddingBlock * 2 + UNREADABLE_ROW.lineHeight
}

function rowsOfRecord(record: TranscriptRecord, position: string): FeedRow[] {
  if (record.kind === 'unreadable') return [{ shape: 'unreadable', id: `unreadable:${position}` }]
  // A subagent's turn is not this Session's history. The CLI nests it; Argo leaves it out rather
  // than drawing another agent's work as the reader's own (see `chainMessages`).
  if (record.kind !== 'message' || record.sidechain) return []
  return record.blocks.map((block, index) => {
    const id = `${record.uuid}:${index}`
    return block.shape === 'prose'
      ? { shape: 'prose', id, role: record.role, text: block.text }
      : { shape: 'source', id, role: record.role, label: block.label, source: block.source }
  })
}

export function projectFeed(chain: SessionChain): FeedRow[] {
  return chain.files.flatMap((file, fileIndex) =>
    file.records.flatMap((record, recordIndex) =>
      rowsOfRecord(record, `${fileIndex}:${recordIndex}`),
    ),
  )
}
