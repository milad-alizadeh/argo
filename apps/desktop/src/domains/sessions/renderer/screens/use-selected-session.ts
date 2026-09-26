import { useArchivedSessions } from '../session-list/archived/use-archived-sessions'
import type { useSessions } from '../use-sessions'

// The active Session list never carries an archived Session (#1593): a direct open of one (a restored
// route, a stored selection) asks the reader for its row by id instead of finding it in the
// active list.
export function useSelectedSession(
  selectedSessionId: string | null,
  sessionList: ReturnType<typeof useSessions>['sessionList'],
) {
  const activeSession = sessionList?.sessions.find(({ id }) => id === selectedSessionId) ?? null
  const archiveRestoreId = activeSession === null ? selectedSessionId : null
  const { restored } = useArchivedSessions(archiveRestoreId !== null, archiveRestoreId)
  return activeSession ?? restored
}
