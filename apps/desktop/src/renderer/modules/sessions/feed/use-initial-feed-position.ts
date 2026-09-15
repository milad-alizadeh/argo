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
    const frame = requestAnimationFrame(() => virtualizer.scrollToEnd())
    return () => cancelAnimationFrame(frame)
  }, [sessionId, viewport, virtualizer])
}
