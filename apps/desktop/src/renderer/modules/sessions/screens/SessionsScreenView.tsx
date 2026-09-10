import { SessionFeed } from '../components/SessionFeed'
import { SessionRoster } from '../components/SessionRoster'
import type { Session, SessionFeed as SessionFeedData, SessionId } from '../types'

type SessionsScreenViewProps = {
  sessions: readonly Session[]
  selectedSessionId: SessionId | null
  feed: SessionFeedData | null
  onSelect: (sessionId: SessionId) => void
  onRefresh: () => void
}

export function SessionsScreenView({
  sessions,
  selectedSessionId,
  feed,
  onSelect,
  onRefresh,
}: SessionsScreenViewProps) {
  return (
    <main className="grid h-dvh min-h-0 grid-cols-[var(--sessions-grid-columns)] bg-canvas max-md:grid-cols-1 max-md:grid-rows-[var(--sessions-mobile-grid-rows)]">
      <SessionRoster
        onSelect={onSelect}
        onRefresh={onRefresh}
        selectedSessionId={selectedSessionId}
        sessions={sessions}
      />
      <div className="min-h-0 overflow-y-auto">
        <SessionFeed error={null} feed={feed} />
      </div>
    </main>
  )
}
