import { useState } from 'react'
import {
  clickSelection,
  EMPTY_ROSTER_SELECTION,
  type SelectionModifier,
} from '../../state/roster-selection'
import type { SessionId } from '../../types'

// The one place #2194's click/Shift/Cmd rules turn into state: a plain click on the row still
// opens it (SessionsSidebarContainer's `onSelect`) and clears this instead of adding to it, so
// opening a Session and multi-selecting stay two different gestures on the same list.
export function useRosterSelection(visibleIds: readonly SessionId[]) {
  const [selection, setSelection] = useState(EMPTY_ROSTER_SELECTION)
  return {
    selectedIds: selection.ids,
    clear: () => setSelection(EMPTY_ROSTER_SELECTION),
    toggle: (sessionId: SessionId, modifier: SelectionModifier) =>
      setSelection((current) => clickSelection(current, visibleIds, { id: sessionId, modifier })),
  }
}
