import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { trpcClient } from '@/platform/renderer/trpc-client'
import { COMPOSER_FOCUS_STATE } from '../../composer-focus-state'
import { invalidateSessionList, markSessionRead } from '../../session-queries'
import type { Session, SessionId } from '../../types'

// What a row's menu and a row's click do, each with one identity for as long as its inputs hold. The
// sessionList's rows are memoized, so a handler rebuilt on every render would re-render all of them on
// each read of the open Session.
export function useSidebarActions() {
  const navigate = useNavigate()
  const location = useLocation()
  const { projectId } = useParams()
  const queryClient = useQueryClient()

  return {
    openNew: useCallback(() => {
      navigate(`/projects/${projectId}/sessions/new`, { state: COMPOSER_FOCUS_STATE })
    }, [navigate, projectId]),

    openTicket: useCallback(
      (session: Session) => {
        if (session.ticket !== null)
          navigate(`/projects/${projectId}/tickets/${session.ticket.key}`)
      },
      [navigate, projectId],
    ),

    rename: useCallback(
      async (session: Session, name: string) => {
        const renamed = await trpcClient.sessions.rename.mutate({
          sessionId: session.id,
          title: name,
        })
        await invalidateSessionList(queryClient)
        return renamed.title
      },
      [queryClient],
    ),

    select: useCallback(
      async (selectedSessionId: SessionId, retiredIds: SessionId[] = []) => {
        navigate(`/projects/${projectId}/sessions/${selectedSessionId}${location.search}`)
        const reply = await window.argo.focusSessionUnread({
          sessionId: selectedSessionId,
          retiredIds,
        })
        if (reply.type === 'session.unread.focused') {
          markSessionRead(queryClient, selectedSessionId, retiredIds)
        }
      },
      [location.search, navigate, projectId, queryClient],
    ),
  }
}
