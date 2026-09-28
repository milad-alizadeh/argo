import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { projectFeedRowEntries } from '@/domains/sessions/api/feed/feed-row-entries'
import type { SessionContractError } from '../session-contract-error'
import type { SessionFeed, SessionFeedSnapshot, SessionId } from '../types'
import { groupToolRuns } from './model/tool-groups'
import { retrySessionFeed, sessionFeedQuery } from './session-feed-query'
import { useLiveFeedEvents } from './use-live-feed-events'

export function displayedFeed({
  selectedSessionId,
  subagentId,
  reading,
  live,
}: {
  selectedSessionId: SessionId | null
  subagentId: string | null
  reading: SessionFeedSnapshot | null
  live: ReturnType<typeof useLiveFeedEvents>
}): SessionFeed | null {
  if (selectedSessionId === null) return null
  const chainId = subagentId ?? selectedSessionId
  const current =
    reading?.sessionId === selectedSessionId && reading.chainId === chainId ? reading : null
  const events = live?.events ?? []
  if (current === null && events.length === 0) return null
  const { entries } = projectFeedRowEntries({
    history: current?.content ?? [],
    live: events,
    activity: null,
  })
  const rows = groupToolRuns(entries.flatMap(({ row }) => (row.shape === 'activity' ? [] : [row])))
  const base = current ?? {
    version: 1,
    type: 'session.feed.read',
    requestId: selectedSessionId,
    sessionId: selectedSessionId,
    chainId,
    revision: 'live',
    content: [],
  }
  return {
    ...base,
    revision: `${base.revision}:${events.at(-1)?.sequence ?? 0}`,
    rows,
  }
}

export function useConsecutiveFeedFailures(
  sessionId: SessionId | null,
  feed: { isSuccess: boolean; isError: boolean; errorUpdatedAt: number },
) {
  const [failedReads, setFailedReads] = useState({ sessionId, lastErrorAt: 0, count: 0 })
  useEffect(() => {
    if (feed.isSuccess || sessionId === null) {
      setFailedReads({ sessionId, lastErrorAt: 0, count: 0 })
      return
    }
    if (!feed.isError) return
    setFailedReads((current) => {
      const count =
        current.sessionId !== sessionId
          ? 1
          : current.count + Number(current.lastErrorAt !== feed.errorUpdatedAt)
      return { sessionId, lastErrorAt: feed.errorUpdatedAt, count }
    })
  }, [feed.errorUpdatedAt, feed.isError, feed.isSuccess, sessionId])
  return failedReads.sessionId === sessionId ? failedReads.count : 0
}

export function useSessionFeed(
  selectedSessionId: SessionId | null,
  subagentId: string | null = null,
) {
  const live = useLiveFeedEvents(selectedSessionId, subagentId)
  const queryClient = useQueryClient()
  // Subscribe first, so events that land during the read are buffered rather than missed.
  const query = sessionFeedQuery(selectedSessionId, subagentId, live?.ready ?? false)
  const history = useQuery<SessionFeedSnapshot | null, SessionContractError>(query)
  const reading = history.data ?? null
  const displayed = useMemo(
    () => displayedFeed({ selectedSessionId, subagentId, reading, live }),
    [reading, live, selectedSessionId, subagentId],
  )
  return {
    feed: displayed,
    liveStatus: live?.events.findLast((event) => event.type === 'status')?.status ?? null,
    feedError: history.error,
    retryFeed: () => void retrySessionFeed(queryClient, query.queryKey, history.refetch),
  }
}
