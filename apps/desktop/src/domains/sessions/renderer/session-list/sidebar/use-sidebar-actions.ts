import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { trpcClient } from '@/platform/renderer/trpc-client'
import { COMPOSER_FOCUS_STATE } from '../../composer-focus-state'
import type { Session, SessionId } from '../../types'
import type { SessionListActions } from '../rows/session-list-actions'
import { useArchiveSelected } from './use-session-archive-mutation'

export function useSidebarActions(projectId: string | null): SessionListActions {
  const navigate = useNavigate()
  const location = useLocation()
  return {
    onArchiveSelected: useArchiveSelected(),
    onNew: () => navigate(`/projects/${projectId}/sessions/new`, { state: COMPOSER_FOCUS_STATE }),
    onOpenTicket: (session: Session) => {
      if (session.ticket !== null) navigate(`/projects/${projectId}/tickets/${session.ticket.key}`)
    },
    onRename: async (session: Session, name: string) => {
      await trpcClient.sessionUpdate.mutate({ sessionIds: [session.id], title: name })
    },
    // Stable, because it reaches every memoized row.
    onSelect: useCallback(
      (selectedSessionId: SessionId) =>
        navigate(`/projects/${projectId}/sessions/${selectedSessionId}${location.search}`),
      [location.search, navigate, projectId],
    ),
  }
}
