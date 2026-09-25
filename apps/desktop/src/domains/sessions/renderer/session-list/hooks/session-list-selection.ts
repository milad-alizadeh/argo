import type { SessionId } from '../../types'

export type SelectionModifier = 'plain' | 'additive' | 'range'

export type SessionListSelection = {
  ids: ReadonlySet<SessionId>
  anchor: SessionId | null
}

export const EMPTY_SESSION_LIST_SELECTION: SessionListSelection = { ids: new Set(), anchor: null }

// A plain click replaces the selection with the one row; the platform modifier toggles it into or
// out of the existing set; Shift replaces the set with the inclusive range from the anchor to the
// row clicked, so a second Shift-click from the same anchor grows or shrinks the same range rather
// than starting a new one. `order` is every row currently on screen, in the order the Session list draws
// them — a stable-id set is used throughout so an anchor a page has since dropped degrades to a
// range of one rather than throwing.
export function clickSessionListSelection(
  current: SessionListSelection,
  order: readonly SessionId[],
  click: { id: SessionId; modifier: SelectionModifier },
): SessionListSelection {
  const { id, modifier } = click
  if (modifier === 'plain') return { ids: new Set([id]), anchor: id }
  if (modifier === 'additive') {
    const ids = new Set(current.ids)
    if (ids.has(id)) ids.delete(id)
    else ids.add(id)
    return { ids, anchor: id }
  }
  const anchor = current.anchor ?? id
  const anchorIndex = order.indexOf(anchor)
  const targetIndex = order.indexOf(id)
  if (anchorIndex === -1 || targetIndex === -1) return { ids: new Set([id]), anchor }
  const [start, end] =
    anchorIndex < targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex]
  return { ids: new Set(order.slice(start, end + 1)), anchor }
}
