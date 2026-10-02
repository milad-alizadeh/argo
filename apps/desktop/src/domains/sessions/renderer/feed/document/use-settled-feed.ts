import { useRef } from 'react'
import type { SessionFeedRow } from '../../types'
export type Settled = {
  reading: {
    sessionId: string
    revision: string
  }
  rows: readonly SessionFeedRow[]
}

// A Turn status row follows its prompt and is no reply (#3161).
export function awaitingAssistantReply(rows: readonly SessionFeedRow[]) {
  const latest = rows.findLast((row) => !(row.shape === 'event' && row.event === 'liveStatus'))
  return latest?.shape === 'prose' && latest.role === 'user'
}

type SettledFeedOptions = {
  sessionId: string | null
  revision: string | null
  rows: readonly SessionFeedRow[]
}

// The Feed receives the full reading here; AnchoredFeed measures it before opening the virtual list.
export function useSettledFeed({ sessionId, revision, rows }: SettledFeedOptions) {
  const column = useRef<HTMLDivElement>(null)
  const settled =
    sessionId !== null && revision !== null ? { reading: { sessionId, revision }, rows } : null

  return { column, settled }
}
