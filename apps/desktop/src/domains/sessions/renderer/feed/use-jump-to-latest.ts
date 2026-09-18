import type { ReactVirtualizer } from '@tanstack/react-virtual'
import { useCallback, useEffect } from 'react'
import type { useFeedTailFollow } from './use-feed-tail-follow'

// Offers the Session screen a Jump to latest action while the active Feed is away from its tail.
export function useJumpToLatest({
  active,
  onJumpToLatestChange,
  sessionId,
  tailFollow,
  virtualizer,
}: {
  active: boolean
  onJumpToLatestChange: (sessionId: string, action: (() => void) | null) => void
  sessionId: string
  tailFollow: ReturnType<typeof useFeedTailFollow>
  virtualizer: ReactVirtualizer<HTMLElement, Element>
}) {
  const jumpToLatest = useCallback(() => {
    virtualizer.scrollToEnd({ behavior: 'smooth' })
  }, [virtualizer])
  const offered = active && !tailFollow.awaitingInitialPosition && !tailFollow.atLatest
  useEffect(() => {
    onJumpToLatestChange(sessionId, offered ? jumpToLatest : null)
    return () => onJumpToLatestChange(sessionId, null)
  }, [jumpToLatest, offered, onJumpToLatestChange, sessionId])
}
