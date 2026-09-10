import type { Session, SessionFeed, SessionId } from '../types'

import { SessionFeed as SessionFeedPanel } from './SessionFeed'
import { SessionRoster } from './SessionRoster'
import { SessionsEmptyState } from './SessionsEmptyState'

type SessionsViewProps = {
  sessions: readonly Session[] | null
  selectedSessionId: SessionId | null
  feed: SessionFeed | null
  error: string | null
  onSelect: (sessionId: SessionId) => void
}

export function SessionsView({ sessions, selectedSessionId, feed, error, onSelect }: SessionsViewProps) {
  if (error !== null) return <SessionsEmptyState message={error} />
  if (sessions === null) return <SessionsEmptyState message="Reading Claude sessions..." />

  return (
    <main className="grid h-dvh min-h-0 grid-cols-[minmax(17rem,26rem)_minmax(0,1fr)] bg-canvas max-md:grid-cols-1 max-md:grid-rows-[minmax(14rem,40vh)_minmax(0,1fr)]">
      <SessionRoster onSelect={onSelect} selectedSessionId={selectedSessionId} sessions={sessions} />
      <div className="min-h-0 overflow-y-auto"><SessionFeed error={null} feed={feed} /></div>
    </main>
  )
}
