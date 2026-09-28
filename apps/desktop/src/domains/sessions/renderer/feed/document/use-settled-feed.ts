import { useRef } from 'react'
import type { SessionFeedRow } from '../../types'
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
  sessionId: string | null
  revision: string | null
  rows: readonly SessionFeedRow[]
}

// Virtual rows are available as soon as the Session Feed arrives. TanStack measures only mounted
// rows and corrects its estimate while keeping the end anchor stable.
export function useSettledFeed({ sessionId, revision, rows }: SettledFeedOptions) {
  const column = useRef<HTMLDivElement>(null)
  const settled =
    sessionId !== null && revision !== null ? { reading: { sessionId, revision }, rows } : null

  return { column, settled }
}
