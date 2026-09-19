import { useRef } from 'react'
import type { FeedLiveFacts } from '@/domains/sessions/renderer/feed/feed-live-facts'
import { isOptimisticSessionId } from '@/domains/sessions/renderer/state/use-session-creation-store'
import type { SessionFeedRow, SessionId } from '@/domains/sessions/renderer/types'

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
