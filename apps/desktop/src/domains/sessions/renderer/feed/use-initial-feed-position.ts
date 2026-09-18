import type { ReactVirtualizer } from '@tanstack/react-virtual'
import { useLayoutEffect, useRef } from 'react'

export function useInitialFeedPosition({
  active,
  following,
  onPositioned,
  sessionId,
  viewport,
  virtualizer,
}: {
  active: boolean
  following: boolean
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
    // Apply the opening position in layout so a delayed initial jump cannot
    // override a reader who has already moved into history. This also lets
    // StrictMode safely skip a position that already happened.
    virtualizer.scrollToEnd()
    onPositioned()
  }, [onPositioned, sessionId, viewport, virtualizer])
  useLayoutEffect(() => {
    const returned = active && !wasActive.current
    wasActive.current = active
    // An inactive document is `content-visibility: hidden` and measures 0x0, so a scrollToEnd
    // made while it was hidden landed at 0; re-pin a following reader once it shows.
    if (returned && following && viewport !== null) virtualizer.scrollToEnd()
  }, [active, following, viewport, virtualizer])
}
