import {
  type SessionFeedRow,
  UNREADABLE_ROW,
  unreadableRowHeight,
} from '@/domains/sessions/contract/models'
import type { TranscriptRecord } from '@/domains/sessions/contract/transcript'
import { isHiddenToolRunBoundary, rowsOfRecord } from '@/domains/sessions/main/feed-row-projection'

export { isHiddenToolRunBoundary, rowsOfRecord, UNREADABLE_ROW, unreadableRowHeight }

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
