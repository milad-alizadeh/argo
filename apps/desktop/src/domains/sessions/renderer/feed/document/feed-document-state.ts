import { useCallback, useRef, useState } from 'react'
import type { FeedPosition } from '../scroll/anchoring'

// The selected Feed's stall bound restarts with each real read or subscription retry (#2102).
export function useFeedRetry(onRetryFeed: () => void) {
  const [retryToken, setRetryToken] = useState(0)
  const retry = useCallback(() => {
    setRetryToken((token) => token + 1)
    onRetryFeed()
  }, [onRetryFeed])
  return { retry, retryToken }
}

// Per-Session reading positions, kept across a switch so BasicFeed can open the next document where
// the reader left it.
export function useFeedScrollPositions() {
  const positions = useRef(new Map<string, FeedPosition>()).current
  const initialPosition = useCallback(
    (sessionId: string) => positions.get(sessionId) ?? null,
    [positions],
  )
  const savePosition = useCallback(
    (sessionId: string, position: FeedPosition) => positions.set(sessionId, position),
    [positions],
  )
  return { initialPosition, savePosition }
}
