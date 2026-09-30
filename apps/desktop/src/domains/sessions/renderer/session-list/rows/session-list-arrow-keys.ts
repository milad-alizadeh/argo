import type { SessionListRow } from './session-list-rows'

const FOCUS_KEYS = ['ArrowDown', 'ArrowUp', 'Home', 'End'] as const
type FocusKey = (typeof FOCUS_KEYS)[number]

export function isFocusKey(key: string): key is FocusKey {
  return (FOCUS_KEYS as readonly string[]).includes(key)
}

// A row the keyboard can land on: a Session, or the list position of one not read yet.
function focusable(row: SessionListRow | undefined): boolean {
  return row?.kind === 'session' || row?.kind === 'sessionPlaceholder'
}

// The list position a key moves focus to from the row at `current`, by list position rather than by
// mounted button, so it reaches rows outside the retained window.
export function focusTarget(
  rows: readonly SessionListRow[],
  current: number,
  key: FocusKey,
): number | null {
  const step = key === 'ArrowDown' || key === 'Home' ? 1 : -1
  let index = { ArrowDown: current + 1, ArrowUp: current - 1, Home: 0, End: rows.length - 1 }[key]
  while (index >= 0 && index < rows.length) {
    if (focusable(rows[index])) return index
    index += step
  }
  return null
}
