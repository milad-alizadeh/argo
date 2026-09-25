import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useProjects } from '@/domains/projects/renderer'
import { currentSessionId } from '@/domains/sessions/renderer/model/models'
import { Roster, type RosterActions } from '../roster'
import { useOrderedSessions } from '../rows/roster-order'
import { useArchiveSelected } from './use-session-archive-mutation'
import { SELECTED_SESSION_KEY, useSidebarActions } from './use-sidebar-actions'

// A stored id absent from the active Roster is not necessarily gone: the active list never
// carries an archived Session, so this can still be one, restored by the Archive section
// asking the reader for it by id (#1593). Navigate under the stored id either way; only a
// Session the reader answers for nowhere at all fails to resolve, same as any stale id.
function useRestoreSelectedSession(options: {
  sessionId: string | undefined
  roster: ReturnType<typeof useOrderedSessions>['roster']
  rosterError: ReturnType<typeof useOrderedSessions>['rosterError']
  navigate: ReturnType<typeof useNavigate>
}) {
  const { sessionId, roster, rosterError, navigate } = options
  useEffect(() => {
    if (sessionId !== undefined || roster === null || rosterError !== null) return
    const storedId = window.localStorage.getItem(SELECTED_SESSION_KEY)
    if (storedId === null) return
    const restoredId = currentSessionId(roster.sessions, storedId) ?? storedId
    navigate(`/sessions/${restoredId}`, { replace: true })
  }, [navigate, roster, rosterError, sessionId])
}

export function SessionsSidebar() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [cockpit] = useProjects()
  const projectRoot = cockpit.project?.path ?? null
  // Read once here for the restore-on-mount effect below, which needs the raw roster to tell a
  // stored id apart from an archived one; Roster's own read of the same query shares this cache.
  const { roster, rosterError } = useOrderedSessions(projectRoot)
  const archiveSelected = useArchiveSelected()
  const sidebarActions = useSidebarActions({
    projectPath: projectRoot,
  })
  useRestoreSelectedSession({ sessionId, roster, rosterError, navigate })

  const actions: RosterActions = {
    onArchiveSelected: archiveSelected,
    onNew: sidebarActions.openNew,
    onOpenTicket: sidebarActions.openTicket,
    onRename: sidebarActions.rename,
    onSelect: sidebarActions.select,
  }

  return (
    <Roster actions={actions} projectRoot={projectRoot} selectedSessionId={sessionId ?? null} />
  )
}
