import {
  type SessionFeedRow,
  UNREADABLE_ROW,
  unreadableRowHeight,
} from '@/domains/sessions/contract/models'
import type { TranscriptRecord } from '@/domains/sessions/contract/transcript'
import { isHiddenToolRunBoundary, rowsOfRecord } from './feed-row-projection'

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

export function withoutRepeatedBreaks(rows: SessionFeedRow[]): SessionFeedRow[] {
  return rows.filter(
    (row, index) => row.shape !== 'unreadable' || rows[index - 1]?.shape !== 'unreadable',
  )
}
