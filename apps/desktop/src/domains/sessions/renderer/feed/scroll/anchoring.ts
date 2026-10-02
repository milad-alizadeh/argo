import { type ReactVirtualizer, useVirtualizer } from '@tanstack/react-virtual'
import type { VirtualItem, Virtualizer } from '@tanstack/virtual-core'
import { useCallback, useInsertionEffect, useLayoutEffect, useRef, useState } from 'react'
import type { SessionFeedRow } from '../../types'

const FEED_ROW_ESTIMATE_PX = 96
const FEED_OVERSCAN = 8
const TAIL_THRESHOLD_PX = 80

export function feedScrollPaddingStart(element: HTMLElement) {
  return Number.parseFloat(getComputedStyle(element).scrollPaddingTop) || 0
}

// Where the Feed's virtualizer attaches: the scrollable element itself, and its top scroll-padding
// read once. The end space is the viewport's CSS padding, which follows the composer (#2835).
export function useFeedViewport() {
  const [viewport, setViewport] = useState<HTMLElement | null>(null)
  const [paddingStart, setPaddingStart] = useState(0)
  const attachViewport = useCallback((element: HTMLElement | null) => {
    if (element !== null) setPaddingStart(feedScrollPaddingStart(element))
    setViewport(element)
  }, [])
  return { attachViewport, paddingStart, viewport }
}

export function useAnchoredVirtualizer({
  following,
  initialMeasurementsCache,
  initialScrollPosition,
  positioned,
  rows,
  viewport,
  paddingStart,
  onChange,
}: {
  following: boolean
  initialMeasurementsCache: VirtualItem[]
  initialScrollPosition: number | null
  positioned: boolean
  rows: readonly SessionFeedRow[]
  viewport: HTMLElement | null
  paddingStart: number
  onChange: (instance: Virtualizer<HTMLElement, Element>, sync: boolean) => void
}) {
  // Rows put before the first one are held by the first visible row, as TanStack's chat guide
  // does; otherwise end anchoring would pin the bottom while a row the reader opened grows.
  const firstRowId = rows[0]?.id
  const committedFirstRowId = useRef(firstRowId)
  useLayoutEffect(() => {
    committedFirstRowId.current = firstRowId
  }, [firstRowId])
  const prepending = firstRowId !== committedFirstRowId.current
  // A new key function makes the virtualizer measure every row again, so it changes with the rows.
  const getItemKey = useCallback((index: number) => feedRowAt(rows, index).id, [rows])
  const virtualizer = useVirtualizer({
    anchorTo: following || prepending ? 'end' : 'start',
    count: rows.length,
    estimateSize: () => FEED_ROW_ESTIMATE_PX,
    // Smooth tail scrolling delays short-row measurement and leaves estimate-sized gaps (#2545).
    followOnAppend: following,
    getItemKey,
    getScrollElement: () => viewport,
    // Seeds the rendered range at construction, not after (#e2e-real-cheap-models): a fresh
    // mount's own scroll listener attaches too late to catch a post-mount scrollTop write, so
    // the range never followed it and the reader landed back at row zero.
    initialOffset: initialScrollPosition ?? 0,
    // Every row's Blink height, measured before the list opens, so `initialOffset` does not drift.
    initialMeasurementsCache,
    onChange,
    overscan: FEED_OVERSCAN,
    paddingStart,
    scrollPaddingStart: paddingStart,
    scrollEndThreshold: TAIL_THRESHOLD_PX,
  })
  // TanStack Virtual takes this only as an instance assignment. Insertion effects run after
  // commit but before row refs measure, so restored heights cannot move the viewport first; once
  // positioned, rows measured above the reader move it again by their change.
  useInsertionEffect(() => {
    virtualizer.shouldAdjustScrollPositionOnItemSizeChange =
      initialScrollPosition === null || positioned ? rowAboveReader : () => false
  }, [initialScrollPosition, positioned, virtualizer])
  return virtualizer
}

// TanStack's own rule, without its skip while scrolling up: a row above the reader that sizes late,
// such as a diagram drawn after mount, otherwise pushes the rows in view down by its growth.
function rowAboveReader(
  item: VirtualItem,
  _delta: number,
  instance: Virtualizer<HTMLElement, Element>,
) {
  const fold = (instance.scrollOffset ?? 0) + instance.scrollAdjustments
  if (instance.itemSizeCache.has(item.key)) return item.end <= fold
  return item.start < fold || aboveMeasuredRowInView(item.index, instance)
}

// A wheel up can show rows shorter than the overscan held; their first height lands above the rows
// the reader was already looking at, so those rows hold still and move only by the wheel.
function aboveMeasuredRowInView(index: number, instance: Virtualizer<HTMLElement, Element>) {
  const lastInView = instance.range?.endIndex ?? -1
  for (let below = index + 1; below <= lastInView; below += 1)
    if (instance.itemSizeCache.has(instance.options.getItemKey(below))) return true
  return false
}

// A composer growing under a Feed at its tail grows the viewport's end padding, which shrinks its
// content box but not the border box TanStack watches, so the tail is pinned again here (#2835).
// One direct write, not `scrollToEnd`, whose re-aiming over later frames would override a reader
// who scrolls away in that time.
export function useTailThroughViewportResize(viewport: HTMLElement | null, following: boolean) {
  const followingNow = useRef(following)
  useLayoutEffect(() => {
    followingNow.current = following
  }, [following])
  useLayoutEffect(() => {
    if (viewport === null) return
    // Read at each scroll, which runs before resize callbacks in a frame, so a reader who just
    // scrolled away is not pulled back by a stale `following`.
    let atEnd = true
    const distanceFromEnd = () => viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop
    const onScroll = () => {
      atEnd = distanceFromEnd() <= 1
    }
    const resizes = new ResizeObserver(() => {
      if (followingNow.current && atEnd && distanceFromEnd() > 1)
        viewport.scrollTop = viewport.scrollHeight
    })
    viewport.addEventListener('scroll', onScroll, { passive: true })
    resizes.observe(viewport)
    return () => {
      viewport.removeEventListener('scroll', onScroll)
      resizes.disconnect()
    }
  }, [viewport])
}

// Home goes to the first loaded row at once. Chromium's own Home animates toward a pixel and moves
// that pixel by each scroll written for a row above the reader that sizes late, so it stopped short.
export function useHomeToFirstRow(
  viewport: HTMLElement | null,
  virtualizer: ReactVirtualizer<HTMLElement, Element>,
) {
  useLayoutEffect(() => {
    if (viewport === null) return
    const onKeyDown = (event: KeyboardEvent) => {
      const modified = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
      if (event.key !== 'Home' || modified || event.defaultPrevented || typing(event.target)) return
      event.preventDefault()
      virtualizer.scrollToOffset(0)
    }
    viewport.addEventListener('keydown', onKeyDown)
    return () => viewport.removeEventListener('keydown', onKeyDown)
  }, [viewport, virtualizer])
}

function typing(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || target.closest('input, textarea, select') !== null
}

function feedRowAt(rows: readonly SessionFeedRow[], index: number) {
  const row = rows[index]
  if (row === undefined) throw new RangeError(`Feed row ${index} is outside the virtualizer range.`)
  return row
}

// Where a newly opened document starts: the reader's remembered position, or the tail. Applied in
// layout so a delayed initial jump cannot override a reader who has already moved into history,
// and so StrictMode safely skips a position that already happened.
export function useInitialFeedPosition({
  initialScrollPosition,
  onPositioned,
  sessionId,
  viewport,
  virtualizer,
}: {
  initialScrollPosition: number | null
  onPositioned: (positionedAtEnd: boolean) => void
  sessionId: string
  viewport: HTMLElement | null
  virtualizer: ReactVirtualizer<HTMLElement, Element>
}) {
  const openedSession = useRef<string | null>(null)
  useLayoutEffect(() => {
    if (viewport === null || openedSession.current === sessionId) return
    openedSession.current = sessionId
    // Apply the opening position in layout so a delayed initial jump cannot
    // override a reader who has already moved into history. This also lets
    // StrictMode safely skip a position that already happened. The virtualizer's own
    // rendered range is already seeded correctly by `initialOffset` at construction
    // (#e2e-real-cheap-models); this write only syncs the visible scrollbar to match it.
    if (initialScrollPosition === null) virtualizer.scrollToEnd()
    else viewport.scrollTop = initialScrollPosition
    // A restored history position is not the tail: reporting it as "at latest" here (#e2e-real-
    // cheap-models) turned tail-follow back on, and the virtualizer's own followOnAppend then
    // snapped a freshly mounted Session straight back to the end on its first render.
    onPositioned(initialScrollPosition === null)
  }, [initialScrollPosition, onPositioned, sessionId, viewport, virtualizer])
}

// Where the reader is: the row at the viewport's top and how far it is scrolled past. A pixel alone
// lands on another row once rows above it, measured or estimated before, are measured again.
export type FeedPosition = { rowId: string; offset: number }

// The pixel `position` stands at in freshly measured rows; a row they no longer hold has none.
export function positionOffset(position: FeedPosition | null, measurements: VirtualItem[]) {
  if (position === null) return null
  const row = measurements.find(({ key }) => key === position.rowId)
  return row === undefined ? null : row.start + position.offset
}

// Remembers where the reader left a document's scroller, so reopening it restores the same place
// rather than the tail.
export function useScrollPositionSnapshot(
  sessionId: string,
  viewport: HTMLElement | null,
  virtualizer: ReactVirtualizer<HTMLElement, Element>,
  onPositionChange: (sessionId: string, position: FeedPosition) => void,
) {
  useLayoutEffect(() => {
    if (viewport === null) return
    const rememberPosition = () => {
      const row = virtualizer.getVirtualItemForOffset(viewport.scrollTop)
      if (row === undefined) return
      onPositionChange(sessionId, {
        rowId: String(row.key),
        offset: viewport.scrollTop - row.start,
      })
    }
    viewport.addEventListener('scroll', rememberPosition, { passive: true })
    return () => {
      viewport.removeEventListener('scroll', rememberPosition)
      rememberPosition()
    }
  }, [onPositionChange, sessionId, viewport, virtualizer])
}
