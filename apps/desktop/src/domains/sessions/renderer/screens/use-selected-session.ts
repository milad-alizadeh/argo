import { useArchivedSessions } from '@/domains/sessions/renderer/roster/use-archived-sessions'
import { useSearchSelection } from '@/domains/sessions/renderer/roster/use-search-selection'
import type { Session, SessionRoster } from '@/domains/sessions/renderer/types'

export function selectedSession(
  selectedSessionId: string | null,
  roster: readonly Session[],
  searched: readonly Session[],
): Session | null {
  return (
    searched.find(({ id }) => id === selectedSessionId) ??
    roster.find(({ id }) => id === selectedSessionId) ??
    null
  )
}

// The active Roster never carries an archived Session (#1593): a direct open of one (a restored
// route, a stored selection) asks the reader for its row by id instead of finding it in the
// Roster's own list.
export function useSelectedSession(selectedSessionId: string | null, roster: SessionRoster | null) {
  const searched = useSearchSelection((state) => state.session)
  const current = selectedSession(
    selectedSessionId,
    roster?.sessions ?? [],
    searched ? [searched] : [],
  )
  const archiveRestoreId = current === null ? selectedSessionId : null
  const { restored } = useArchivedSessions(archiveRestoreId !== null, archiveRestoreId)
  return current ?? restored
}
