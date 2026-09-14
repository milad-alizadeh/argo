import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { currentSessionId } from '@/core/sessions/models'
import { useSelectedProject } from '../../projects/hooks/useSelectedProject'
import { useSessions } from '../hooks/useSessions'
import { useSessionTicketLink } from '../hooks/useSessionTicketLink'
import type { Session, SessionId } from '../types'
import { SessionsSidebarContent } from './SessionsSidebar'
import { SessionTicketLinkDialog } from './SessionTicketLinkDialog'

const SELECTED_SESSION_KEY = 'argo.selected-session-id'

export function SessionsSidebar() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { roster, rosterError } = useSessions(null)
  const project = useSelectedProject()
  const ticketLink = useSessionTicketLink()
  const [linkTarget, setLinkTarget] = useState<Session | null>(null)
  useEffect(() => {
    if (sessionId !== undefined || roster === null || rosterError !== null) return
    const storedId = window.localStorage.getItem(SELECTED_SESSION_KEY)
    if (storedId === null) return
    // A stored id absent from the active Roster is not necessarily gone: the active list never
    // carries an archived Session, so this can still be one, restored by the Archive section
    // asking the reader for it by id (#1593). Navigate under the stored id either way; only a
    // Session the reader answers for nowhere at all fails to resolve, same as any stale id.
    const restoredId = currentSessionId(roster.sessions, storedId) ?? storedId
    navigate(`/sessions/${restoredId}`, { replace: true })
  }, [navigate, roster, rosterError, sessionId])

  return (
    <>
      <SessionsSidebarContent
        onLinkTicket={setLinkTarget}
        onNew={() => navigate('/sessions/new')}
        onOpenTicket={(session) => {
          if (session.ticket !== null) navigate(`/tickets/${session.ticket.key}`)
        }}
        onRename={async (session, name) => {
          const reply = await window.argo.renameSession({ sessionId: session.id, name })
          if (reply.type === 'session.renamed') return reply.title
          throw new Error(reply.message)
        }}
        onSelect={(selectedSessionId: SessionId) => {
          window.localStorage.setItem(SELECTED_SESSION_KEY, selectedSessionId)
          navigate(`/sessions/${selectedSessionId}`)
        }}
        onUnlinkTicket={(session) => void ticketLink.disconnect(session.id)}
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
