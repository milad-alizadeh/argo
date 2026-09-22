import { useCallback, useRef, useState } from 'react'
import { isOptimisticSessionId } from '../../session-creation'
import type { SessionFeed, SessionFeedRow, SessionId } from '../../types'
import type { FeedLiveFacts } from './feed-live-facts'

// The Standing spinner has no bound of its own: a Session whose read never answers (#2102) never
// gets a kept document, so `current` (from useKeptDocuments) stays null forever without a retry
// token to key the stall timer's reset on.
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
  if (sessionId !== null && row !== null) held.current = { sessionId, row }
  else if (held.current !== null && sessionId !== held.current.sessionId) {
    // The temporary id hands over to the real one, and the prompt goes with it.
    const handedOver = isOptimisticSessionId(held.current.sessionId) && sessionId !== null
    held.current = handedOver ? { sessionId, row: held.current.row } : null
  }
  if (liveFacts === null || row !== null || held.current === null) return liveFacts
  return { ...liveFacts, settledPromptRow: held.current.row }
}

// One active document is enough now that the Feed is virtualized. Retaining inactive documents
// retains their row data, mounted virtualizer state, and rich-content work; repeated switching
// used to grow that retained set to six full transcripts.
export function useKeptDocuments(feed: SessionFeed | null, selectedSessionId: SessionId | null) {
  const current = feed !== null && feed.sessionId === selectedSessionId ? feed : null
  const ordered = current === null ? [] : [[current.sessionId, current] as const]
  return { current, ordered }
}
