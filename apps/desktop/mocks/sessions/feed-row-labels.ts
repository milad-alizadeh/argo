import type { SessionFeedRow } from '@/domains/sessions/api/feed/feed-rows'

// A Feed's prompt and reply rows by role and its Session status rows by status, in Feed order.
export function feedRowLabels(rows: readonly SessionFeedRow[]): string[] {
  return rows.flatMap((row) => {
    if (row.shape === 'event' && row.event === 'liveStatus' && row.text !== null) return [row.text]
    return row.shape === 'prose' ? [row.role] : []
  })
}
