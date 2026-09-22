import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { useComposerStore } from '../../composer/hooks'
import { COMPOSER_FOCUS_STATE } from '../../composer-focus-state'
import { newSessionTarget, useSessionCreationStore } from '../../session-creation'
import { invalidateSessionRoster } from '../../session-queries'
import type { Session, SessionId } from '../../types'

export const SELECTED_SESSION_KEY = 'argo.selected-session-id'

// What a row's menu and a row's click do, each with one identity for as long as its inputs hold. The
// roster's rows are memoized, so a handler rebuilt on every render would re-render all of them on
// each read of the open Session.
export function useSidebarActions(options: {
  disconnectTicket: (sessionId: string) => void
  projectPath: string | null
}) {
  const { projectPath, disconnectTicket: disconnect } = options
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const lastHarness = useComposerStore(({ harness }) => harness)
  const pending = useSessionCreationStore(({ pending }) => pending)

  return {
    openNew: useCallback(() => {
      const target = newSessionTarget(lastHarness, projectPath)
      if (target === null) {
        navigate('/sessions/new')
        return
      }
      navigate(`/sessions/${target}`, { state: COMPOSER_FOCUS_STATE })
    }, [lastHarness, navigate, projectPath]),

    openTicket: useCallback(
      (session: Session) => {
        if (session.ticket !== null) navigate(`/tickets/${session.ticket.key}`)
      },
      [navigate],
    ),

    rename: useCallback(async (session: Session, name: string) => {
      const reply = await window.argo.renameSession({ sessionId: session.id, name })
      if (reply.type === 'session.renamed') return reply.title
      throw new Error(reply.message)
    }, []),

    select: useCallback(
      async (selectedSessionId: SessionId) => {
        // Picking a different row abandons an un-sent draft rather than leaving it a ghost row
        // nobody will ever send (#2109).
        if (pending?.stage === 'draft' && pending.id !== selectedSessionId) {
          useSessionCreationStore.getState().abandon(pending.id)
        }
        window.localStorage.setItem(SELECTED_SESSION_KEY, selectedSessionId)
        navigate(`/sessions/${selectedSessionId}`)
        const reply = await window.argo.focusSessionUnread({ sessionId: selectedSessionId })
        if (reply.type === 'session.unread.focused') {
          await invalidateSessionRoster(queryClient)
        }
      },
      [navigate, pending, queryClient],
    ),

    unlinkTicket: useCallback((session: Session) => void disconnect(session.id), [disconnect]),
  }
}
