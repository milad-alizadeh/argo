import { useCallback, useRef, useState } from 'react'
import type { Session, SessionId } from '../../types'
import type { SessionListActions } from '../rows/session-list-actions'
import {
  clickSessionListSelection,
  EMPTY_SESSION_LIST_SELECTION,
  type SelectionModifier,
} from './session-list-selection'

// The one place #2194's click/Shift/Cmd rules turn into state: a plain click on the row still
// opens it and clears this instead of adding to it, so opening a Session and multi-selecting stay
// two different gestures on the same list.
export function useSessionListSelection(
  sessions: readonly Session[],
  openSessionId: SessionId | null,
  { onArchiveSelected, onSelect }: Pick<SessionListActions, 'onArchiveSelected' | 'onSelect'>,
) {
  const [selection, setSelection] = useState(EMPTY_SESSION_LIST_SELECTION)
  // The list a click ranges over is read at click time, through a ref. A Session list read rebuilds
  // `sessions` whenever one Session changes, so a handler that closed over it changed identity
  // with it and re-rendered all 82 memoized rows for one row's transcript (#2386).
  const clicked = useRef({ openSessionId, sessions })
  clicked.current = { openSessionId, sessions }
  const clear = useCallback(() => setSelection(EMPTY_SESSION_LIST_SELECTION), [])
  const toggle = useCallback(
    (sessionId: SessionId, modifier: SelectionModifier) =>
      setSelection((current) => {
        // A Shift-click before any bulk selection exists ranges from the Session already open,
        // not from whichever row happens to be clicked first (#2194 follow-up): the open row is
        // what the reader sees as "selected" on the screen, so it is the anchor a first Shift-click
        // expects.
        const anchored =
          current.anchor === null &&
          current.ids.size === 0 &&
          clicked.current.openSessionId !== null
            ? { ...current, anchor: clicked.current.openSessionId }
            : current
        const visibleIds = clicked.current.sessions.map((session) => session.id)
        return clickSessionListSelection(anchored, visibleIds, { id: sessionId, modifier })
      }),
    [],
  )
  // Stable, because it reaches every memoized row.
  const select = useCallback(
    (sessionId: SessionId) => {
      clear()
      onSelect(sessionId)
    },
    [clear, onSelect],
  )
  // Archiving a selected row archives the whole selection; any other row goes alone.
  const archive = (sessionId: SessionId) => {
    const bulk = selection.ids.has(sessionId)
    onArchiveSelected(bulk ? [...selection.ids] : [sessionId])
    if (bulk) clear()
  }
  return { selectedIds: selection.ids, archive, select, toggle }
}
