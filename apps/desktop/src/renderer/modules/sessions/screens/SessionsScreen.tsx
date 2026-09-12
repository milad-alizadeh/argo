import { useSessions } from '../hooks/useSessions'
import { useSessionsStore } from '../state/useSessionsStore'
import { SessionPage } from './SessionPage'

export function SessionsScreen({ projectName }: { projectName: string }) {
  const selectedSessionId = useSessionsStore((state) => state.selectedSessionId)
  const selectSession = useSessionsStore((state) => state.selectSession)
  const { feed, feedError, roster, rosterError, reread } = useSessions(selectedSessionId)

  return (
    <SessionPage
      feed={feed}
      failure={rosterError}
      onReread={reread}
      onSelect={selectSession}
      projectName={projectName}
      selectedSessionId={selectedSessionId}
      sessions={roster?.sessions ?? []}
      loading={roster === null && rosterError === null}
      feedFailure={feedError}
    />
  )
}
