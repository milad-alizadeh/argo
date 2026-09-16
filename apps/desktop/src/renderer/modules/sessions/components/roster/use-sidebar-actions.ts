import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { COMPOSER_FOCUS_STATE } from '../../composer-focus-state'
import { useComposerStore } from '../../state/use-composer-store'
import { newSessionTarget, useSessionCreationStore } from '../../state/use-session-creation-store'
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
  const lastHarness = useComposerStore(({ harness }) => harness)
  const pending = useSessionCreationStore(({ pending }) => pending)

  return {
    // The sidebar's "+" control never reaches here with no Project selected: it shows the reader
    // where to go instead (#2307). This guard stays as the seam's own defense, not a live path.
    openNew: useCallback(() => {
      const target = newSessionTarget(lastHarness, projectPath)
      if (target === null) return
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
      (selectedSessionId: SessionId) => {
        // Picking a different row abandons an un-sent draft rather than leaving it a ghost row
        // nobody will ever send (#2109).
        if (pending?.stage === 'draft' && pending.id !== selectedSessionId) {
          useSessionCreationStore.getState().abandon(pending.id)
        }
        window.localStorage.setItem(SELECTED_SESSION_KEY, selectedSessionId)
        navigate(`/sessions/${selectedSessionId}`)
      },
      [navigate, pending],
    ),

    unlinkTicket: useCallback((session: Session) => void disconnect(session.id), [disconnect]),
  }
}
