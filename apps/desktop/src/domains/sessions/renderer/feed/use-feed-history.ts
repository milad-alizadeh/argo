import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { SessionContractError } from '../session-contract-error'
import type { SessionFeedPage, SessionId } from '../types'
import {
  feedChainKey,
  loadOlderFeedPage,
  type OlderPagesByChain,
  touchOlderFeedChain,
} from './feed-history-pages'
import {
  readSessionFeedPage,
  refreshSessionFeed,
  retrySessionFeed,
  sessionFeedQuery,
} from './session-feed-query'

export function mergedContent(
  pages: readonly SessionFeedPage[],
  latest: SessionFeedPage,
): FeedContent[] {
  const merged: FeedContent[] = []
  const positions = new Map<string, number>()
  for (const item of [...pages, latest].flatMap((page) => page.content)) {
    const position = positions.get(item.id)
    if (position === undefined) {
      positions.set(item.id, merged.length)
      merged.push(item)
    } else merged[position] = item
  }
  return merged
}

function useOlderPages({
  sessionId,
  subagentId,
  latestCursor,
  refreshLatest,
}: {
  sessionId: SessionId | null
  subagentId: string | null
  latestCursor: string | null
  refreshLatest: () => Promise<SessionFeedPage | null>
}) {
  const key = feedChainKey(sessionId, subagentId)
  const [olderByChain, setOlderByChain] = useState<OlderPagesByChain>({})
  const loadingKeys = useRef(new Set<string>())
  useEffect(() => {
    setOlderByChain((previous) => touchOlderFeedChain(previous, key))
  }, [key])
  const current = olderByChain[key] ?? null
  const cursor = current === null ? latestCursor : current.cursor
  const loadOlder = useCallback(async () => {
    await loadOlderFeedPage({
      sessionId,
      subagentId,
      cursor,
      loadingKeys: loadingKeys.current,
      refreshLatest,
      readPage: readSessionFeedPage,
      setOlderByChain,
    })
  }, [cursor, refreshLatest, sessionId, subagentId])
  return { current, cursor, loadOlder }
}

export function useFeedHistory(
  sessionId: SessionId | null,
  subagentId: string | null,
  enabled = true,
) {
  const queryClient = useQueryClient()
  const query = sessionFeedQuery(sessionId, subagentId, enabled)
  const latest = useQuery<SessionFeedPage | null, SessionContractError>(query)
  const refetchLatest = latest.refetch
  const refreshLatest = useCallback(
    () =>
      sessionId === null
        ? Promise.resolve(null)
        : refreshSessionFeed(queryClient, sessionId, subagentId),
    [queryClient, sessionId, subagentId],
  )
  const { current, cursor, loadOlder } = useOlderPages({
    sessionId,
    subagentId,
    latestCursor: latest.data?.olderCursor ?? null,
    refreshLatest,
  })
  const reading = useMemo(() => {
    const feed = latest.data
    if (feed === null || feed === undefined || current === null || current.pages.length === 0)
      return feed ?? null
    const content = mergedContent(current.pages, feed)
    return {
      ...feed,
      content,
      olderCursor: current.cursor,
      revision: `${feed.revision}:${current.pages[0]?.revision ?? ''}`,
    }
  }, [current, latest.data])
  return {
    reading,
    error: latest.error,
    isSuccess: latest.isSuccess,
    isError: latest.isError,
    errorUpdatedAt: latest.errorUpdatedAt,
    loadOlder,
    hasOlder: cursor !== null && !(current?.failed ?? false),
    loadingOlder: current?.loading ?? false,
    olderError: current?.failed ?? false,
    retry: () => void retrySessionFeed(queryClient, query.queryKey, refetchLatest),
  }
}
