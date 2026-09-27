import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useRef, useState } from 'react'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { SessionContractError } from '../session-contract-error'
import type { SessionFeed, SessionId } from '../types'
import { readSessionFeedPage, retrySessionFeed, sessionFeedQuery } from './session-feed-query'

type OlderPages = {
  key: string
  pages: SessionFeed[]
  cursor: string | null
  loading: boolean
  failed: boolean
}

export function mergedContent(pages: readonly SessionFeed[], latest: SessionFeed): FeedContent[] {
  const merged: FeedContent[] = []
  const positions = new Map<string, number>()
  for (const item of [...pages, latest].flatMap((page) => page.content ?? [])) {
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
  refetchLatest,
}: {
  sessionId: SessionId | null
  subagentId: string | null
  latestCursor: string | null
  refetchLatest: () => Promise<unknown>
}) {
  const key = `${sessionId ?? ''}:${subagentId ?? ''}`
  const [older, setOlder] = useState<OlderPages | null>(null)
  const loadingKey = useRef<string | null>(null)
  const current = older?.key === key ? older : null
  const cursor = current === null ? latestCursor : current.cursor
  const loadOlder = useCallback(async () => {
    if (sessionId === null || cursor === null || loadingKey.current === key) return
    loadingKey.current = key
    setOlder((previous) => ({
      key,
      pages: previous?.key === key ? previous.pages : [],
      cursor,
      loading: true,
      failed: false,
    }))
    try {
      const page = await readSessionFeedPage(sessionId, subagentId, cursor)
      setOlder((previous) =>
        previous?.key === key
          ? {
              key,
              pages: [page, ...previous.pages],
              cursor: page.olderCursor ?? null,
              loading: false,
              failed: false,
            }
          : previous,
      )
    } catch (error) {
      if (error instanceof Error && error.message === 'expired-feed-cursor') {
        setOlder(null)
        await refetchLatest()
        return
      }
      setOlder((previous) =>
        previous?.key === key ? { ...previous, loading: false, failed: true } : previous,
      )
    } finally {
      if (loadingKey.current === key) loadingKey.current = null
    }
  }, [cursor, key, refetchLatest, sessionId, subagentId])
  return { current, cursor, loadOlder }
}

export function useFeedHistory(
  sessionId: SessionId | null,
  subagentId: string | null,
  enabled = true,
) {
  const queryClient = useQueryClient()
  const query = sessionFeedQuery(sessionId, subagentId, enabled)
  const latest = useQuery<SessionFeed | null, SessionContractError>(query)
  const refetchLatest = latest.refetch
  const { current, cursor, loadOlder } = useOlderPages({
    sessionId,
    subagentId,
    latestCursor: latest.data?.olderCursor ?? null,
    refetchLatest,
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
