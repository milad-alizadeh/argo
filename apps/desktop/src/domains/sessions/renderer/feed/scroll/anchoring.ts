import type { ReactVirtualizer } from '@tanstack/react-virtual'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { VirtualItem, Virtualizer } from '@tanstack/virtual-core'
import { type ReactNode, useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { SessionFeedRow } from '../../types'

const FEED_ROW_ESTIMATE_PX = 96
const FEED_OVERSCAN = 8
const TAIL_THRESHOLD_PX = 80
const TAIL_KEY = 'feed-tail'

// Where the Feed's virtualizer attaches: the scrollable element itself, and the scroll-padding
// read off it once, since that padding never changes after mount.
export function useFeedViewport() {
  const [viewport, setViewport] = useState<HTMLElement | null>(null)
  const [padding, setPadding] = useState({ start: 0, end: 0 })
  const attachViewport = useCallback((element: HTMLElement | null) => {
    if (element !== null) {
      const style = getComputedStyle(element)
      setPadding({
        start: Number.parseFloat(style.scrollPaddingTop) || 0,
        end: Number.parseFloat(style.scrollPaddingBottom) || 0,
      })
    }
    setViewport(element)
  }, [])
  return { attachViewport, padding, viewport }
}

export function useAnchoredVirtualizer({
  following,
  initialMeasurementsCache,
  initialScrollPosition,
  rows,
  tail,
  viewport,
  padding,
  onChange,
}: {
  following: boolean
  initialMeasurementsCache: VirtualItem[]
  initialScrollPosition: number | null
  rows: readonly SessionFeedRow[]
  tail: ReactNode
  viewport: HTMLElement | null
  padding: { start: number; end: number }
  onChange: (instance: Virtualizer<HTMLElement, Element>, sync: boolean) => void
}) {
  return useVirtualizer({
    anchorTo: following ? 'end' : 'start',
    count: rows.length + (tail === null ? 0 : 1),
    estimateSize: () => FEED_ROW_ESTIMATE_PX,
    // Smooth tail scrolling delays short-row measurement and leaves estimate-sized gaps (#2545).
    followOnAppend: following,
    getItemKey: (index) => (index === rows.length ? TAIL_KEY : feedRowAt(rows, index).id),
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
    paddingStart: padding.start,
    paddingEnd: padding.end,
    scrollPaddingStart: padding.start,
    scrollEndThreshold: TAIL_THRESHOLD_PX,
  })
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
