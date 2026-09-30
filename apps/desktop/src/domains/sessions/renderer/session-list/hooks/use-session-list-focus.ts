import { type RefObject, useLayoutEffect, useState } from 'react'
import type { Session, SessionId } from '../../types'

export function useSessionListFocus(
  sidebar: RefObject<HTMLElement | null>,
  sessions: readonly Session[],
  selectedSessionId: SessionId | null,
) {
  const [focusedSessionId, setFocusedSessionId] = useState<SessionId | null>(null)
  const listed = (sessionId: SessionId | null) =>
    sessionId !== null && sessions.some((session) => session.id === sessionId)
  const focusedListed = listed(focusedSessionId)
  const tabStop =
    (focusedListed ? focusedSessionId : null) ??
    (listed(selectedSessionId) ? selectedSessionId : null) ??
    sessions[0]?.id ??
    null

  useLayoutEffect(() => {
    if (focusedSessionId === null || focusedListed) return
    setFocusedSessionId(null)
    if (document.activeElement !== document.body || tabStop === null) return
    const buttons = sidebar.current?.querySelectorAll<HTMLButtonElement>('button[data-session-id]')
    const fallback = [...(buttons ?? [])].find((button) => button.dataset.sessionId === tabStop)
    fallback?.focus()
  }, [focusedListed, focusedSessionId, sidebar, tabStop])

  return { setFocusedSessionId, tabStop }
}
