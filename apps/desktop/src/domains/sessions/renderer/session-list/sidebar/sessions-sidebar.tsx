import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useProjects } from '@/domains/projects/renderer'
import { currentSessionId } from '@/domains/sessions/contract/model/models'
import { useOrderedSessions } from '../rows/session-list-order'
import { SessionList, type SessionListActions } from '../session-list'
import { UnreadMarkerPrototypeSwitcher } from '../unread-marker-prototype'
import { useArchiveSelected } from './use-session-archive-mutation'
import { SELECTED_SESSION_KEY, useSidebarActions } from './use-sidebar-actions'

// A stored id absent from the active SessionList is not necessarily gone: the active list never
// carries an archived Session, so this can still be one, restored by the Archive section
// asking the reader for it by id (#1593). Navigate under the stored id either way; only a
// Session the reader answers for nowhere at all fails to resolve, same as any stale id.
function useRestoreSelectedSession(options: {
  sessionId: string | undefined
  sessionList: ReturnType<typeof useOrderedSessions>['sessionList']
  sessionListError: ReturnType<typeof useOrderedSessions>['sessionListError']
  navigate: ReturnType<typeof useNavigate>
}) {
  const { sessionId, sessionList, sessionListError, navigate } = options
  useEffect(() => {
    if (sessionId !== undefined || sessionList === null || sessionListError !== null) return
    const storedId = window.localStorage.getItem(SELECTED_SESSION_KEY)
    if (storedId === null) return
    const restoredId = currentSessionId(sessionList.sessions, storedId) ?? storedId
    navigate(`/sessions/${restoredId}`, { replace: true })
  }, [navigate, sessionList, sessionListError, sessionId])
}

export function SessionsSidebar() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [cockpit] = useProjects()
  const projectRoot = cockpit.project?.path ?? null
  // Read once here for the restore-on-mount effect below, which needs the raw Session list to tell a
  // stored id apart from an archived one; SessionList's own read of the same query shares this cache.
  const { sessionList, sessionListError } = useOrderedSessions(projectRoot)
  const archiveSelected = useArchiveSelected()
  const sidebarActions = useSidebarActions({
    projectPath: projectRoot,
  })
  useRestoreSelectedSession({ sessionId, sessionList, sessionListError, navigate })

  const actions: SessionListActions = {
    onArchiveSelected: archiveSelected,
    onNew: sidebarActions.openNew,
    onOpenTicket: sidebarActions.openTicket,
    onRename: sidebarActions.rename,
    onSelect: sidebarActions.select,
  }

  return (
    <>
      <SessionList
        actions={actions}
        projectRoot={projectRoot}
        selectedSessionId={sessionId ?? null}
      />
      <UnreadMarkerPrototypeSwitcher />
    </>
  )
}
