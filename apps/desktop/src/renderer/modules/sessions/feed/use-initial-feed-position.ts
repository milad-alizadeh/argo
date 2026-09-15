import type { ReactVirtualizer } from '@tanstack/react-virtual'
import { useLayoutEffect, useRef } from 'react'

export function useInitialFeedPosition({
  sessionId,
  viewport,
  virtualizer,
}: {
  sessionId: string
  viewport: HTMLElement | null
  virtualizer: ReactVirtualizer<HTMLElement, Element>
}) {
  const openedSession = useRef<string | null>(null)
  useLayoutEffect(() => {
    if (viewport === null || openedSession.current === sessionId) return
    openedSession.current = sessionId
    // Apply the opening position in layout so a delayed initial jump cannot
    // override a reader who has already moved into history.
    virtualizer.scrollToEnd()
  }, [sessionId, viewport, virtualizer])
}
