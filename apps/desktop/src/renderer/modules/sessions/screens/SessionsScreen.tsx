import { SessionFeed } from '../components/SessionFeed'
import { SessionRoster } from '../components/SessionRoster'
import { SessionsEmptyState } from '../components/SessionsEmptyState'
import { useSessions } from '../hooks/useSessions'
import { useSessionsStore } from '../state/useSessionsStore'

export function SessionsScreen() {
  const selectedSessionId = useSessionsStore((state) => state.selectedSessionId)
  const selectSession = useSessionsStore((state) => state.selectSession)
  const { feed, feedError, roster, rosterError } = useSessions(selectedSessionId)
  if (rosterError !== null) return <SessionsEmptyState message={rosterError} />
  if (roster === null) return <SessionsEmptyState message="Reading Claude sessions..." />
  return <main className="grid h-dvh min-h-0 grid-cols-[minmax(17rem,26rem)_minmax(0,1fr)] bg-canvas max-md:grid-cols-1 max-md:grid-rows-[minmax(14rem,40vh)_minmax(0,1fr)]"><SessionRoster onSelect={selectSession} selectedSessionId={selectedSessionId} sessions={roster.sessions} /><div className="min-h-0 overflow-y-auto"><SessionFeed error={feedError} feed={feed} /></div></main>
}
