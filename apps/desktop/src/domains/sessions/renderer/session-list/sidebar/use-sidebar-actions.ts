import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { useComposerStore } from '../../composer/hooks/use-composer-store'
import { COMPOSER_FOCUS_STATE } from '../../composer-focus-state'
import { newSessionTarget, useSessionCreationStore } from '../../session-creation'

export const SELECTED_SESSION_KEY = 'argo.selected-session-id'

// What a row's menu and a row's click do, each with one identity for as long as its inputs hold. The
// sessionList's rows are memoized, so a handler rebuilt on every render would re-render all of them on
// each read of the open Session.
export function useSidebarActions(options: { projectPath: string | null }) {
  const { projectPath } = options
  const navigate = useNavigate()
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

    select: useCallback(
      (selectedSessionId: string) => {
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
  }
}
