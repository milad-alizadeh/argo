import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import { currentSessionId } from '@/core/sessions/models'
import { useSessions } from '../hooks/useSessions'
import type { SessionId } from '../types'
import { SessionsSidebarContent } from './SessionsSidebar'

const SELECTED_SESSION_KEY = 'argo.selected-session-id'

export function SessionsSidebar() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { roster, rosterError } = useSessions(null)
  useEffect(() => {
    if (sessionId !== undefined || roster === null || rosterError !== null) return
    const storedId = window.localStorage.getItem(SELECTED_SESSION_KEY)
    if (storedId === null) return
    const restoredId = currentSessionId(roster.sessions, storedId)
    if (restoredId === null) {
      window.localStorage.removeItem(SELECTED_SESSION_KEY)
      return
    }
    navigate(`/sessions/${restoredId}`, { replace: true })
  }, [navigate, roster, rosterError, sessionId])

  return (
    <SessionsSidebarContent
      onNew={() => navigate('/sessions/new')}
      onRename={async (session, name) => {
        const reply = await window.argo.renameSession({ sessionId: session.id, name })
        if (reply.type === 'session.renamed') return reply.title
        throw new Error(reply.message)
      }}
      onSelect={(selectedSessionId: SessionId) => {
        window.localStorage.setItem(SELECTED_SESSION_KEY, selectedSessionId)
        navigate(`/sessions/${selectedSessionId}`)
      }}
      roster={roster}
      rosterError={rosterError}
      selectedSessionId={sessionId ?? null}
    />
  )
}
