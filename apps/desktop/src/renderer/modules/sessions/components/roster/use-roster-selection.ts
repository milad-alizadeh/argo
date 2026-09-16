import { useCallback, useMemo, useState } from 'react'
import {
  clickSelection,
  EMPTY_ROSTER_SELECTION,
  type SelectionModifier,
} from '../../state/roster-selection'
import type { SessionId } from '../../types'

// The one place #2194's click/Shift/Cmd rules turn into state: a plain click on the row still
// opens it (SessionsSidebarContainer's `onSelect`) and clears this instead of adding to it, so
// opening a Session and multi-selecting stay two different gestures on the same list.
export function useRosterSelection(
  visibleIds: readonly SessionId[],
  openSessionId: SessionId | null,
) {
  const [selection, setSelection] = useState(EMPTY_ROSTER_SELECTION)
  const clear = useCallback(() => setSelection(EMPTY_ROSTER_SELECTION), [])
  const toggle = useCallback(
    (sessionId: SessionId, modifier: SelectionModifier) =>
      setSelection((current) => {
        // A Shift-click before any bulk selection exists ranges from the Session already open,
        // not from whichever row happens to be clicked first (#2194 follow-up): the open row is
        // what the reader sees as "selected" on the screen, so it is the anchor a first Shift-click
        // expects.
        const anchored =
          current.anchor === null && current.ids.size === 0 && openSessionId !== null
            ? { ...current, anchor: openSessionId }
            : current
        return clickSelection(anchored, visibleIds, { id: sessionId, modifier })
      }),
    [openSessionId, visibleIds],
  )
  // One stable object: the sidebar reads it into memoized rows, where a fresh object per render
  // would re-render every row on every poll tick.
  return useMemo(
    () => ({ selectedIds: selection.ids, clear, toggle }),
    [clear, selection.ids, toggle],
  )
}
