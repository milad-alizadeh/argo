import { useArchivedSessions } from '../hooks/use-archived-sessions'
import type { useSessions } from '../hooks/use-sessions'

// The active Roster never carries an archived Session (#1593): a direct open of one (a restored
// route, a stored selection) asks the reader for its row by id instead of finding it in the
// Roster's own list.
export function useSelectedSession(
  selectedSessionId: string | null,
  roster: ReturnType<typeof useSessions>['roster'],
) {
  const activeSession = roster?.sessions.find(({ id }) => id === selectedSessionId) ?? null
  const archiveRestoreId = activeSession === null ? selectedSessionId : null
  const { restored } = useArchivedSessions(archiveRestoreId !== null, archiveRestoreId)
  return activeSession ?? restored
}
