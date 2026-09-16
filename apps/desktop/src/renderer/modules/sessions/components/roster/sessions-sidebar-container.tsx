import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { currentSessionId } from '@/core/sessions/models'
import { useProjects } from '../../../projects/hooks/use-projects'
import { useSelectedProject } from '../../../projects/hooks/use-selected-project'
import { useArchiveSelected } from '../../hooks/use-session-archive-mutation'
import { useSessionTicketLink } from '../../hooks/use-session-ticket-link'
import { useSessions } from '../../hooks/use-sessions'
import type { Session } from '../../types'
import { useRosterOrder } from './roster-order'
import { SessionTicketLinkDialog } from './session-ticket-link-dialog'
import { SessionsSidebarContent } from './sessions-sidebar'
import { SELECTED_SESSION_KEY, useSidebarActions } from './use-sidebar-actions'

// A stored id absent from the active Roster is not necessarily gone: the active list never
// carries an archived Session, so this can still be one, restored by the Archive section
// asking the reader for it by id (#1593). Navigate under the stored id either way; only a
// Session the reader answers for nowhere at all fails to resolve, same as any stale id.
function useRestoreSelectedSession(options: {
  sessionId: string | undefined
  roster: ReturnType<typeof useSessions>['roster']
  rosterError: ReturnType<typeof useSessions>['rosterError']
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

// The sidebar is the only reader that shows the roster as a list, so the order it holds rows in is
// its own concern rather than the read's.
function useSidebarRoster(projectRoot: string | null) {
  const read = useSessions(null, true, projectRoot)
  return { ...read, roster: useRosterOrder(read.roster, projectRoot) }
}

export function SessionsSidebar() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [cockpit] = useProjects()
  const { roster, rosterError, hasMoreSessions, isFetchingMoreSessions, fetchMoreSessions } =
    useSidebarRoster(cockpit.project?.path ?? null)
  const project = useSelectedProject()
  const ticketLink = useSessionTicketLink()
  const [linkTarget, setLinkTarget] = useState<Session | null>(null)
  const archiveSelected = useArchiveSelected()
  const actions = useSidebarActions({
    disconnectTicket: ticketLink.disconnect,
    projectPath: cockpit.project?.path ?? null,
  })
  useRestoreSelectedSession({ sessionId, roster, rosterError, navigate })

  return (
    <>
      <SessionsSidebarContent
        hasMoreSessions={hasMoreSessions}
        isFetchingMoreSessions={isFetchingMoreSessions}
        onArchiveSelected={archiveSelected}
        onFetchMoreSessions={fetchMoreSessions}
        onLinkTicket={setLinkTarget}
        onNew={actions.openNew}
        onOpenTicket={actions.openTicket}
        onRename={actions.rename}
        onSelect={actions.select}
        onUnlinkTicket={actions.unlinkTicket}
        roster={roster}
        rosterError={rosterError}
        selectedSessionId={sessionId ?? null}
      />
      <SessionTicketLinkDialog
        onConnect={ticketLink.connect}
        onOpenChange={(open) => {
          if (!open) setLinkTarget(null)
        }}
        projectId={project?.id ?? null}
        session={linkTarget}
      />
    </>
  )
}
