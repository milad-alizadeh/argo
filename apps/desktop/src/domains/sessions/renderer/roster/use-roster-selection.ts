import { useCallback, useMemo, useRef, useState } from 'react'
import {
  clickSelection,
  EMPTY_ROSTER_SELECTION,
  type SelectionModifier,
} from '@/domains/sessions/renderer/roster/roster-selection'
import type { SessionId } from '@/domains/sessions/renderer/types'

// The one place #2194's click/Shift/Cmd rules turn into state: a plain click on the row still
// opens it (SessionsSidebarContainer's `onSelect`) and clears this instead of adding to it, so
// opening a Session and multi-selecting stay two different gestures on the same list.
export function useRosterSelection(
  visibleIds: readonly SessionId[],
  openSessionId: SessionId | null,
) {
  const [selection, setSelection] = useState(EMPTY_ROSTER_SELECTION)
  // The list a click ranges over is read at click time, through a ref. A roster read rebuilds
  // `visibleIds` whenever one Session changes, so a handler that closed over it changed identity
  // with it and re-rendered all 82 memoized rows for one row's transcript (#2386).
  const clicked = useRef({ openSessionId, visibleIds })
  clicked.current = { openSessionId, visibleIds }
  const clear = useCallback(() => setSelection(EMPTY_ROSTER_SELECTION), [])
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
        return clickSelection(anchored, clicked.current.visibleIds, { id: sessionId, modifier })
      }),
    [],
  )
  // One stable object: the sidebar reads it into memoized rows, where a fresh object per render
  // would re-render every row on every roster read.
  return useMemo(
    () => ({ selectedIds: selection.ids, clear, toggle }),
    [clear, selection.ids, toggle],
  )
}
