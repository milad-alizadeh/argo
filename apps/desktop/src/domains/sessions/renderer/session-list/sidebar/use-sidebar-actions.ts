import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useComposerStore } from '../../composer/hooks/use-composer-store'
import { COMPOSER_FOCUS_STATE } from '../../composer-focus-state'
import { newSessionTarget, useSessionCreationStore } from '../../session-creation'
import { markSessionRead } from '../../session-queries'
import type { Session, SessionId } from '../../types'

// What a row's menu and a row's click do, each with one identity for as long as its inputs hold. The
// sessionList's rows are memoized, so a handler rebuilt on every render would re-render all of them on
// each read of the open Session.
export function useSidebarActions(options: { projectPath: string | null }) {
  const { projectPath } = options
  const navigate = useNavigate()
  const { projectId } = useParams()
  const queryClient = useQueryClient()
  const lastHarness = useComposerStore(({ harness }) => harness)
  const pending = useSessionCreationStore(({ pending }) => pending)

  return {
    openNew: useCallback(() => {
      const target = newSessionTarget(lastHarness, projectPath)
      if (target === null) {
        navigate(`/projects/${projectId}/sessions/new`)
        return
      }
      navigate(`/projects/${projectId}/sessions/${target}`, { state: COMPOSER_FOCUS_STATE })
    }, [lastHarness, navigate, projectId, projectPath]),

    openTicket: useCallback(
      (session: Session) => {
        if (session.ticket !== null)
          navigate(`/projects/${projectId}/tickets/${session.ticket.key}`)
      },
      [navigate, projectId],
    ),

    rename: useCallback(async (session: Session, name: string) => {
      const reply = await window.argo.renameSession({ sessionId: session.id, name })
      if (reply.type === 'session.renamed') return reply.title
      throw new Error(reply.message)
    }, []),

    select: useCallback(
      async (selectedSessionId: SessionId, retiredIds: SessionId[] = []) => {
        // Picking a different row abandons an un-sent draft rather than leaving it a ghost row
        // nobody will ever send (#2109).
        if (pending?.stage === 'draft' && pending.id !== selectedSessionId) {
          useSessionCreationStore.getState().abandon(pending.id)
        }
        navigate(`/projects/${projectId}/sessions/${selectedSessionId}`)
        const reply = await window.argo.focusSessionUnread({
          sessionId: selectedSessionId,
          retiredIds,
        })
        if (reply.type === 'session.unread.focused') {
          markSessionRead(queryClient, selectedSessionId, retiredIds)
        }
      },
      [navigate, pending, projectId, queryClient],
    ),
  }
}
