import type { SessionFeed as SessionFeedData } from '../types'

import { SessionFeedRow } from './SessionFeedRow'
import { SessionsEmptyState } from './SessionsEmptyState'

type SessionFeedProps = { feed: SessionFeedData | null; error: string | null }

export function SessionFeed({ feed, error }: SessionFeedProps) {
  if (error !== null) return <SessionsEmptyState message={error} />
  if (feed === null)
    return <SessionsEmptyState message="Select a session to read its terminal activity." />
  if (feed.rows.length === 0)
    return <SessionsEmptyState message="This session has no terminal activity yet." />
  return (
    <section aria-label="Session activity" className="min-h-full bg-canvas">
      {feed.rows.map((row) => (
        <SessionFeedRow key={row.id} row={row} />
      ))}
    </section>
  )
}
