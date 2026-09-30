import type { Virtualizer } from '@tanstack/react-virtual'
import {
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react'
import { focusTarget, isFocusKey } from './session-list-arrow-keys'
import { isActiveListPosition, type SessionListRow } from './session-list-rows'

type ListVirtualizer = Virtualizer<HTMLDivElement, Element>

function activeLength(rows: readonly SessionListRow[]): number {
  const end = rows.findIndex((row) => !isActiveListPosition(row))
  return end === -1 ? rows.length : end
}

// Tells the list which active positions are on screen, so it can move its retained window.
export function useActiveRange(
  rows: readonly SessionListRow[],
  range: { startIndex: number; endIndex: number } | null,
  onShowRange: (start: number, end: number) => void,
) {
  const length = activeLength(rows)
  const start = range?.startIndex ?? -1
  const end = Math.min(range?.endIndex ?? -1, length - 1)
  useEffect(() => {
    if (start >= 0 && start < length) onShowRange(start, end)
  }, [end, length, onShowRange, start])
}

type RowPlace = { id: string; offset: number }
type ScrollAnchor = { first: RowPlace; next: RowPlace | null }

function sessionIndex(rows: readonly SessionListRow[], id: string): number {
  return rows.findIndex((row) => row.kind === 'session' && row.session.id === id)
}

// The anchor while it still stands above its recorded neighbour; once it moved past it or is gone,
// the neighbour holds the view instead.
function survivingPlace(rows: readonly SessionListRow[], anchor: ScrollAnchor) {
  const first = sessionIndex(rows, anchor.first.id)
  const next = anchor.next === null ? -1 : sessionIndex(rows, anchor.next.id)
  if (first !== -1 && (next === -1 || next > first)) return { index: first, place: anchor.first }
  if (next !== -1 && anchor.next !== null) return { index: next, place: anchor.next }
  return null
}

function recordAnchor(
  virtualizer: ListVirtualizer,
  rows: readonly SessionListRow[],
  scrollTop: number,
): ScrollAnchor | null {
  const places = virtualizer
    .getVirtualItems()
    .filter((item) => item.end > scrollTop)
    .flatMap((item) => {
      const row = rows[item.index]
      return row?.kind === 'session' ? [{ id: row.session.id, offset: item.start - scrollTop }] : []
    })
  const [first, next] = places
  return first === undefined ? null : { first, next: next ?? null }
}

// Keeps the first visible Session at the same pixel offset when a new window or a reorder moves it
// to another list position. At the very top the list follows its new first row instead.
export function useScrollAnchor(virtualizer: ListVirtualizer, rows: readonly SessionListRow[]) {
  const anchor = useRef<ScrollAnchor | null>(null)
  useLayoutEffect(() => {
    const saved = anchor.current
    const scrollTop = virtualizer.scrollElement?.scrollTop ?? 0
    const surviving = saved === null || scrollTop <= 0 ? null : survivingPlace(rows, saved)
    const item = surviving === null ? undefined : virtualizer.measurementsCache[surviving.index]
    if (surviving === null || item === undefined) return
    const target = item.start - surviving.place.offset
    if (Math.abs(target - scrollTop) >= 1) virtualizer.scrollToOffset(target)
  }, [rows, virtualizer])
  // Recorded after every render from the element's own position, which a restore above has moved.
  useLayoutEffect(() => {
    anchor.current = recordAnchor(virtualizer, rows, virtualizer.scrollElement?.scrollTop ?? 0)
  })
}

// Arrow keys, Home and End move by list position. A position outside the retained window scrolls
// into view, and focus lands on its Session once its window is read and its row is mounted, unless
// a wheel or pointer took over first.
export function useListFocus(
  virtualizer: ListVirtualizer,
  rows: readonly SessionListRow[],
  scrollRef: RefObject<HTMLDivElement | null>,
) {
  const pending = useRef<number | null>(null)
  const focusPending = useCallback(() => {
    const index = pending.current
    const row = index === null ? undefined : rows[index]
    if (row?.kind !== 'session') return
    const button = scrollRef.current?.querySelector<HTMLButtonElement>(
      `button[data-session-id="${CSS.escape(row.session.id)}"]`,
    )
    if (button === null || button === undefined) return
    pending.current = null
    button.focus()
  }, [rows, scrollRef])
  useEffect(() => focusPending())
  useEffect(() => {
    const element = scrollRef.current
    const forget = () => {
      pending.current = null
    }
    element?.addEventListener('wheel', forget, { passive: true })
    element?.addEventListener('pointerdown', forget)
    return () => {
      element?.removeEventListener('wheel', forget)
      element?.removeEventListener('pointerdown', forget)
    }
  }, [scrollRef])
  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLUListElement>) => {
      if (!isFocusKey(event.key)) return
      const button = (event.target as HTMLElement).closest<HTMLElement>('button[data-session-id]')
      const id = button?.dataset.sessionId
      const current = rows.findIndex((row) => row.kind === 'session' && row.session.id === id)
      if (current === -1) return
      event.preventDefault()
      const target = focusTarget(rows, current, event.key)
      if (target === null) return
      pending.current = target
      virtualizer.scrollToIndex(target, { align: 'auto' })
      focusPending()
    },
    [focusPending, rows, virtualizer],
  )
  return onKeyDown
}
