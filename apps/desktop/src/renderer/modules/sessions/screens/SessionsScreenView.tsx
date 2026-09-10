import type { Session, SessionFeed, SessionId } from '../types'

import { SessionFeedPanel } from '../components/SessionFeed'
import { SessionRoster } from '../components/SessionRoster'

type SessionsScreenViewProps = {
  sessions: readonly Session[]
  selectedSessionId: SessionId | null
  feed: SessionFeed | null
  onSelect: (sessionId: SessionId) => void
}

export function SessionsScreenView({ sessions, selectedSessionId, feed, onSelect }: SessionsScreenViewProps) {
  return (
    <main className="grid h-dvh min-h-0 grid-cols-[minmax(17rem,26rem)_minmax(0,1fr)] bg-canvas max-md:grid-cols-1 max-md:grid-rows-[minmax(14rem,40vh)_minmax(0,1fr)]">
      <SessionRoster onSelect={onSelect} selectedSessionId={selectedSessionId} sessions={sessions} />
      <div className="min-h-0 overflow-y-auto"><SessionFeedPanel error={null} feed={feed} /></div>
    </main>
  )
}
