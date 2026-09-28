import { type ReactVirtualizer, useVirtualizer } from '@tanstack/react-virtual'
import type { VirtualItem, Virtualizer } from '@tanstack/virtual-core'
import {
  type ReactNode,
  useCallback,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import type { SessionFeedRow } from '../../types'

const FEED_ROW_ESTIMATE_PX = 96
const FEED_OVERSCAN = 8
const TAIL_THRESHOLD_PX = 80
export const FEED_TAIL_KEY = 'feed-tail'

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
  rows,
  tail,
  viewport,
  paddingStart,
  onChange,
}: {
  following: boolean
  initialMeasurementsCache: VirtualItem[]
  initialScrollPosition: number | null
  rows: readonly SessionFeedRow[]
  tail: ReactNode
  viewport: HTMLElement | null
  paddingStart: number
  onChange: (instance: Virtualizer<HTMLElement, Element>, sync: boolean) => void
}) {
  const virtualizer = useVirtualizer({
    anchorTo: following ? 'end' : 'start',
    count: rows.length + (tail === null ? 0 : 1),
    estimateSize: () => FEED_ROW_ESTIMATE_PX,
    // Smooth tail scrolling delays short-row measurement and leaves estimate-sized gaps (#2545).
    followOnAppend: following,
    getItemKey: (index) => (index === rows.length ? FEED_TAIL_KEY : feedRowAt(rows, index).id),
    getScrollElement: () => viewport,
    // Seeds the rendered range at construction, not after (#e2e-real-cheap-models): a fresh
    // mount's own scroll listener attaches too late to catch a post-mount scrollTop write, so
    // the range never followed it and the reader landed back at row zero.
    initialOffset: initialScrollPosition ?? 0,
    // Without the prior mount's real row heights, a fresh instance settles its estimate sizes
    // into place after seeding `initialOffset` and drifts the reader off the restored pixel
    // (#e2e-real-cheap-models). TanStack's own scroll-restoration guide pairs both.
    initialMeasurementsCache,
    onChange,
    overscan: FEED_OVERSCAN,
    paddingStart,
    scrollPaddingStart: paddingStart,
    scrollEndThreshold: TAIL_THRESHOLD_PX,
  })
  // TanStack Virtual takes this only as an instance assignment. Insertion effects run after
  // commit but before row refs measure, so restored heights cannot move the viewport first.
  useInsertionEffect(() => {
    virtualizer.shouldAdjustScrollPositionOnItemSizeChange =
      initialScrollPosition === null ? undefined : () => false
  }, [initialScrollPosition, virtualizer])
  return virtualizer
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

// Remembers where the reader left a document's scroller, so reopening it (kept-document.tsx)
// restores the same place rather than the tail.
export function useScrollPositionSnapshot(
  sessionId: string,
  viewport: HTMLElement | null,
  virtualizer: ReactVirtualizer<HTMLElement, Element>,
  onPositionChange: (sessionId: string, position: number) => void,
  onMeasurementsChange: (sessionId: string, measurements: VirtualItem[]) => void,
) {
  useLayoutEffect(() => {
    if (viewport === null) return
    const rememberPosition = () => onPositionChange(sessionId, viewport.scrollTop)
    viewport.addEventListener('scroll', rememberPosition, { passive: true })
    return () => {
      viewport.removeEventListener('scroll', rememberPosition)
      rememberPosition()
      // A fresh remount seeds only `scrollTop` (`initialOffset`); its own estimate-sized rows then
      // measure for real and drift the reader off the saved pixel (#e2e-real-cheap-models). The
      // TanStack docs pair `initialOffset` with `initialMeasurementsCache` from `takeSnapshot()`
      // for exactly this: https://tanstack.com/router/latest/docs/guide/scroll-restoration.
      onMeasurementsChange(sessionId, virtualizer.takeSnapshot())
    }
  }, [onMeasurementsChange, onPositionChange, sessionId, viewport, virtualizer])
}
