import { type RefObject, useCallback, useMemo } from 'react'
import type { Session, SessionId } from '../../types'
import { useSessionListFocus } from '../hooks/use-session-list-focus'
import { useSessionListSelection } from '../hooks/use-session-list-selection'
import type { SessionListActions } from '../rows/session-list-actions'

// Which rows are picked out in bulk, where the keyboard is, and what a row's archive and open do.
export function useSidebarSessionList({
  actions: { onArchiveSelected, onSelect },
  sessions,
  selectedSessionId,
  sidebar,
}: {
  actions: Pick<SessionListActions, 'onArchiveSelected' | 'onSelect'>
  sessions: readonly Session[]
  selectedSessionId: SessionId | null
  sidebar: RefObject<HTMLElement | null>
}) {
  const sessionIds = useMemo(() => sessions.map((session) => session.id), [sessions])
  const selection = useSessionListSelection(sessionIds, selectedSessionId)
  const focus = useSessionListFocus(sidebar, sessions, selectedSessionId)

  // Both keep one identity for as long as their inputs do: a row is memoized, so a handler rebuilt
  // on every render would re-render every row whenever anything else on the screen ticked.
  const archive = useCallback(
    (sessionId: SessionId) => {
      const bulk = selection.selectedIds.has(sessionId)
      onArchiveSelected(bulk ? [...selection.selectedIds] : [sessionId])
      if (bulk) selection.clear()
    },
    [onArchiveSelected, selection],
  )
  const select = useCallback(
    (sessionId: SessionId) => {
      selection.clear()
      onSelect(sessionId)
    },
    [onSelect, selection],
  )

  return { archive, focus, select, selection }
}
