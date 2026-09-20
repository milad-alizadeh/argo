import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useProjects, useSelectedProject } from '@/domains/projects/renderer/port'
import { currentSessionId } from '@/domains/sessions/contract/model/models'
import { Roster, type RosterActions } from '@/domains/sessions/renderer/roster/roster'
import { useOrderedSessions } from '@/domains/sessions/renderer/roster/roster-order'
import { SessionTicketLinkDialog } from '@/domains/sessions/renderer/roster/session-ticket-link-dialog'
import { UnreadMarkerPrototypeSwitcher } from '@/domains/sessions/renderer/roster/unread-marker-prototype'
import { useArchiveSelected } from '@/domains/sessions/renderer/roster/use-session-archive-mutation'
import { useSessionTicketLink } from '@/domains/sessions/renderer/roster/use-session-ticket-link'
import {
  SELECTED_SESSION_KEY,
  useSidebarActions,
} from '@/domains/sessions/renderer/roster/use-sidebar-actions'
import type { Session } from '@/domains/sessions/renderer/types'

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
  const project = useSelectedProject()
  const ticketLink = useSessionTicketLink()
  const [linkTarget, setLinkTarget] = useState<Session | null>(null)
  const archiveSelected = useArchiveSelected()
  const sidebarActions = useSidebarActions({
    disconnectTicket: ticketLink.disconnect,
    projectPath: projectRoot,
  })
  useRestoreSelectedSession({ sessionId, roster, rosterError, navigate })

  const actions: RosterActions = {
    onArchiveSelected: archiveSelected,
    onLinkTicket: setLinkTarget,
    onNew: sidebarActions.openNew,
    onOpenTicket: sidebarActions.openTicket,
    onRename: sidebarActions.rename,
    onSelect: sidebarActions.select,
    onUnlinkTicket: sidebarActions.unlinkTicket,
  }

  return (
    <>
      <Roster actions={actions} projectRoot={projectRoot} selectedSessionId={sessionId ?? null} />
      <SessionTicketLinkDialog
        onConnect={ticketLink.connect}
        onOpenChange={(open) => {
          if (!open) setLinkTarget(null)
        }}
        projectId={project?.id ?? null}
        session={linkTarget}
      />
      <UnreadMarkerPrototypeSwitcher />
    </>
  )
}
