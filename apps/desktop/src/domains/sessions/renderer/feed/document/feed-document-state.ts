import { useCallback, useRef, useState } from 'react'

// The selected Feed's stall bound restarts with each real read or subscription retry (#2102).
export function useFeedRetry(onRetryFeed: () => void) {
  const [retryToken, setRetryToken] = useState(0)
  const retry = useCallback(() => {
    setRetryToken((token) => token + 1)
    onRetryFeed()
  }, [onRetryFeed])
  return { retry, retryToken }
}

// Per-Session scroll offsets, kept across a switch so BasicFeed can open the next document where
// the reader left it.
export function useFeedScrollPositions() {
  const positions = useRef(new Map<string, number>()).current
  const initialPosition = useCallback(
    (sessionId: string) => positions.get(sessionId) ?? null,
    [positions],
  )
  const savePosition = useCallback(
    (sessionId: string, position: number) => positions.set(sessionId, position),
    [positions],
  )
  return { initialPosition, savePosition }
}
