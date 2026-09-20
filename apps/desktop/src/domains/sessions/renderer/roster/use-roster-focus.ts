import { type RefObject, useLayoutEffect, useState } from 'react'
import { currentSessionId } from '@/domains/sessions/contract/models'
import type { SessionId, SessionsListed } from '@/domains/sessions/renderer/types'

export function useRosterFocus(
  sidebar: RefObject<HTMLElement | null>,
  visible: SessionsListed['sessions'],
  selectedSessionId: SessionId | null,
) {
  const [focusedSessionId, setFocusedSessionId] = useState<SessionId | null>(null)
  const focusedCurrentId =
    focusedSessionId === null ? null : currentSessionId(visible, focusedSessionId)
  const selectedCurrentId =
    selectedSessionId === null ? null : currentSessionId(visible, selectedSessionId)
  const tabStop = focusedCurrentId ?? selectedCurrentId ?? visible[0]?.id ?? null
  const focusedExactIdExists = visible.some((session) => session.id === focusedSessionId)

  useLayoutEffect(() => {
    if (focusedSessionId === null || focusedExactIdExists) return
    setFocusedSessionId(focusedCurrentId)
    if (document.activeElement !== document.body || tabStop === null) return
    const buttons = sidebar.current?.querySelectorAll<HTMLButtonElement>('button[data-session-id]')
    const fallback = [...(buttons ?? [])].find((button) => button.dataset.sessionId === tabStop)
    fallback?.focus()
  }, [focusedCurrentId, focusedExactIdExists, focusedSessionId, sidebar, tabStop])

  return { setFocusedSessionId, tabStop }
}
