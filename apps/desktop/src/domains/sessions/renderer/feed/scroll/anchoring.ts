import type { ReactVirtualizer } from '@tanstack/react-virtual'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Virtualizer } from '@tanstack/virtual-core'
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
  rows,
  tail,
  viewport,
  padding,
  onChange,
}: {
  following: boolean
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
  active,
  following,
  initialScrollPosition,
  onPositioned,
  sessionId,
  viewport,
  virtualizer,
}: {
  active: boolean
  following: boolean
  initialScrollPosition: number | null
  onPositioned: () => void
  sessionId: string
  viewport: HTMLElement | null
  virtualizer: ReactVirtualizer<HTMLElement, Element>
}) {
  const openedSession = useRef<string | null>(null)
  const wasActive = useRef(active)
  useLayoutEffect(() => {
    if (viewport === null || openedSession.current === sessionId) return
    openedSession.current = sessionId
    if (initialScrollPosition === null) virtualizer.scrollToEnd()
    else viewport.scrollTop = initialScrollPosition
    onPositioned()
  }, [initialScrollPosition, onPositioned, sessionId, viewport, virtualizer])
  useLayoutEffect(() => {
    const returned = active && !wasActive.current
    wasActive.current = active
    // An inactive document is `content-visibility: hidden` and measures 0x0, so a scrollToEnd
    // made while it was hidden landed at 0; re-pin a following reader once it shows.
    if (returned && following && viewport !== null) virtualizer.scrollToEnd()
  }, [active, following, viewport, virtualizer])
}

// Remembers where the reader left a document's scroller, so reopening it (kept-document.tsx)
// restores the same place rather than the tail.
export function useScrollPositionSnapshot(
  sessionId: string,
  viewport: HTMLElement | null,
  onPositionChange: (sessionId: string, position: number) => void,
) {
  useLayoutEffect(() => {
    if (viewport === null) return
    const rememberPosition = () => onPositionChange(sessionId, viewport.scrollTop)
    viewport.addEventListener('scroll', rememberPosition, { passive: true })
    return () => {
      viewport.removeEventListener('scroll', rememberPosition)
      rememberPosition()
    }
  }, [onPositionChange, sessionId, viewport])
}
