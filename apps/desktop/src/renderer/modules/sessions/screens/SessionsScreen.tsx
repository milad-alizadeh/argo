import { SessionsEmptyState } from '../components/SessionsEmptyState'
import { useSessions } from '../hooks/useSessions'
import { useSessionsStore } from '../state/useSessionsStore'
import { SessionsScreenView } from './SessionsScreenView'

export function SessionsScreen() {
  const selectedSessionId = useSessionsStore((state) => state.selectedSessionId)
  const selectSession = useSessionsStore((state) => state.selectSession)
  const { feed, feedError, roster, rosterError } = useSessions(selectedSessionId)
  if (rosterError !== null) return <SessionsEmptyState message={rosterError} />
  if (roster === null) return <SessionsEmptyState message="Reading Claude sessions..." />
  if (feedError !== null) return <SessionsEmptyState message={feedError} />
  return (
    <SessionsScreenView
      feed={feed}
      onSelect={selectSession}
      selectedSessionId={selectedSessionId}
      sessions={roster.sessions}
    />
  )
}
