import type { SessionFeedOutput } from '../../contract/session-history'

export function mergeSessionFeed(
  history: SessionFeedOutput | null,
  live: SessionFeedOutput | null,
): SessionFeedOutput | null {
  if (history === null && live === null) return null
  if (history === null) return live
  if (live === null) return history
  const rows = new Map<string, SessionFeedOutput['rows'][number]>()
  for (const row of history.rows) rows.set(row.id, row)
  for (const row of live.rows) {
    const previous = rows.get(row.id)
    if (
      previous === undefined ||
      (previous.shape === 'prose' &&
        row.shape === 'prose' &&
        row.text.length > previous.text.length)
    )
      rows.set(row.id, row)
  }
  const merged = [...rows.values()]
  return {
    ...history,
    rows: merged,
    revision: JSON.stringify(merged),
    live: live.live,
    working: live.working,
    availability: live.live ? live.availability : history.availability,
  }
}
