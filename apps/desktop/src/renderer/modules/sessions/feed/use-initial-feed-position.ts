import type { ReactVirtualizer } from '@tanstack/react-virtual'
import { useLayoutEffect, useRef } from 'react'

export function useInitialFeedPosition({
  onPositioned,
  sessionId,
  viewport,
  virtualizer,
}: {
  onPositioned: () => void
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
    // StrictMode safely skip a position that already happened.
    virtualizer.scrollToEnd()
    onPositioned()
  }, [onPositioned, sessionId, viewport, virtualizer])
}
