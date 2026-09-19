import type { SessionFeedRow } from '@/domains/sessions/contract/feed-rows'

// The kind, status, label and text of every Tool Call a Feed draws, in order, however grouped.
export function toolCallsOf(rows: SessionFeedRow[]) {
  return rows.flatMap((row) =>
    row.shape === 'tool-group'
      ? row.calls.map(({ kind, status, label, text }) => ({ kind, status, label, text }))
      : [],
  )
}
