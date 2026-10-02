import { skipToken, useQuery } from '@tanstack/react-query'
import { trpc } from '@/platform/renderer/trpc-client'
import type { SessionDetails, SessionExtras, SessionId } from '../types'

// A Session's details by ID, independent of the Session list. A revisit draws cached details until
// main's reply, so the composer stays steady (#2836).
export function useSessionDetails(sessionId: SessionId | null) {
  const { data } = useQuery(
    trpc.sessionDetails.queryOptions(sessionId === null ? skipToken : { sessionId }),
  )
  const session: (SessionDetails & SessionExtras) | null = data ?? null
  return { session, loaded: sessionId !== null && data !== undefined }
}
