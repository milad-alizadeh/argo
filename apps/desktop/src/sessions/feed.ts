// Projecting a stitched chain into the rows the Feed draws. Records are transcript lines; rows
// are what the Feed draws, and the two counts differ (ADR-0033 · Context).
import type { SessionChain } from './chains'
import type { TranscriptRecord } from './records'

export type FeedRow =
  // Laid out by Blink at the real column width, and drawn by the layout that measured it.
  | { shape: 'prose'; id: string; role: 'user' | 'assistant'; text: string }
  // The honest source fallback for content this Feed does not draw richly yet. The label is the
  // block's own type verbatim, the body is its own JSON, and neither is summarised.
  | { shape: 'source'; id: string; role: 'user' | 'assistant'; label: string; source: string }
  // A transcript line Argo could not read. Drawn rather than dropped, so a damaged file reads as
  // damaged instead of as a shorter Session. Its height is arithmetic; see UNREADABLE_ROW.
  | { shape: 'unreadable'; id: string }

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
