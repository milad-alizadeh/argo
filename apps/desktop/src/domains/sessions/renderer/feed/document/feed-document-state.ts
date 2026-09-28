import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { SessionFeedRow, SessionId } from '../../types'
import type { FeedLiveFacts } from './feed-live-facts'

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

// The Turn Marker retires when the roster moves, which can precede the transcript's first row.
// The Feed keeps the last prompt it saw for this Session so the bubble never blinks out (#2430).
export function useHeldPrompt(
  sessionId: SessionId | null,
  liveFacts: FeedLiveFacts,
): FeedLiveFacts {
  const held = useRef<{ sessionId: SessionId; row: SessionFeedRow } | null>(null)
  const row = liveFacts?.optimisticRow ?? liveFacts?.settledPromptRow ?? null
  useLayoutEffect(() => {
    if (sessionId !== null && row !== null) held.current = { sessionId, row }
    else if (held.current !== null && sessionId !== held.current.sessionId) held.current = null
  }, [row, sessionId])
  if (
    liveFacts === null ||
    row !== null ||
    held.current === null ||
    held.current.sessionId !== sessionId
  )
    return liveFacts
  return { ...liveFacts, settledPromptRow: held.current.row }
}
