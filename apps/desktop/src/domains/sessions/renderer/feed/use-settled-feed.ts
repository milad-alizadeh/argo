import { useCallback, useRef, useState } from 'react'
import type { SessionFeedRow } from '@/domains/sessions/renderer/types'
import { FEED_STALL_TIMEOUT_MS, useStallTimer } from './feed-stall'
export type Settled = {
  reading: {
    sessionId: string
    revision: string
  }
  rows: readonly SessionFeedRow[]
}

export function awaitingAssistantReply(rows: readonly SessionFeedRow[]) {
  const latest = rows.at(-1)
  return latest?.shape === 'prose' && latest.role === 'user'
}

type SettledFeedOptions = {
  active: boolean
  sessionId: string | null
  revision: string | null
  rows: readonly SessionFeedRow[]
  isRunning: boolean
  stallTimeoutMs?: number
}

// Virtual rows are available as soon as the Session Feed arrives. TanStack measures only mounted
// rows and corrects its estimate while keeping the end anchor stable.
export function useSettledFeed({
  active,
  sessionId,
  revision,
  rows,
  isRunning,
  stallTimeoutMs = FEED_STALL_TIMEOUT_MS,
}: SettledFeedOptions) {
  const column = useRef<HTMLDivElement>(null)
  const [retryToken, setRetryToken] = useState(0)
  const settled =
    active && sessionId !== null && revision !== null
      ? { reading: { sessionId, revision }, rows }
      : null

  // The Feed pane shows RunningFeed exactly while this is true (feed-content.tsx). Past the
  // bound, it shows StalledFeed instead of spinning forever (#2102).
  // A kept document keeps its own hook instance for the Session it belongs to (basic-feed.tsx), so
  // this bound only ever watches a first load: a later revision leaves the previous settled
  // document in place (the rule above). A later prompt makes `awaitingFeed` true again until the
  // next assistant delivery arrives.
  const awaitingFeed =
    isRunning &&
    (settled === null || settled.rows.length === 0 || awaitingAssistantReply(settled.rows))
  const stalled = useStallTimer(awaitingFeed ? `${sessionId}:${retryToken}` : false, stallTimeoutMs)

  const retry = useCallback(() => {
    setRetryToken((token) => token + 1)
  }, [])

  return { column, settled, stalled, retry }
}
