import { SessionsView } from '../components/SessionsView'
import { useSessions } from '../hooks/useSessions'
import { useSessionsStore } from '../state/useSessionsStore'

export function SessionsScreen() {
  const selectedSessionId = useSessionsStore((state) => state.selectedSessionId)
  const selectSession = useSessionsStore((state) => state.selectSession)
  const { feed, feedError, roster, rosterError } = useSessions(selectedSessionId)
  return <SessionsView error={rosterError ?? feedError} feed={feed} onSelect={selectSession} selectedSessionId={selectedSessionId} sessions={roster?.sessions ?? null} />
}
