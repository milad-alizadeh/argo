import { skipToken, useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { queryClient, trpcClient } from '@/platform/renderer/trpc-client'
import { sessionDetailsQueryKey } from '../session-queries'
import type { SessionId } from '../types'

// A Session's details by ID, independent of the roster, read again when main announces a change.
// A revisit draws cached details until main's reply, so the composer stays steady (#2836).
export function useSessionDetails(sessionId: SessionId | null) {
  useEffect(() => {
    if (sessionId === null) return
    const subscription = trpcClient.sessionListChanged.subscribe(undefined, {
      onData: ({ sessionIds }) => {
        if (sessionIds.includes(sessionId))
          queryClient.invalidateQueries({ queryKey: sessionDetailsQueryKey(sessionId) })
      },
    })
    return () => subscription.unsubscribe()
  }, [sessionId])
  const { data } = useQuery({
    queryKey: sessionDetailsQueryKey(sessionId),
    queryFn: sessionId === null ? skipToken : () => trpcClient.sessionDetails.query({ sessionId }),
  })
  return { session: data ?? null, loaded: sessionId !== null && data !== undefined }
}
