import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { describe, expect, test, vi } from 'vitest'
import {
  retrySessionFeed,
  sessionFeedQuery,
} from '@/domains/sessions/renderer/feed/session-feed-query'

function feedReply(sessionId: string, requestId: string, revision: string) {
  return {
    version: 1,
    type: 'session.feed.read' as const,
    requestId,
    sessionId,
    chainId: sessionId,
    revision,
    rows: [],
  }
}

test('reads a newly started Session by its real identifier', async () => {
  const readSessionFeed = vi
    .fn()
    .mockResolvedValue(feedReply('session-new', 'new-session-feed', 'initial'))
  const originalWindow = globalThis.window
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { argo: { cancelSessionFeed: vi.fn(), readSessionFeed } },
  })
  const options = sessionFeedQuery(new QueryClient(), 'session-new', null)

  try {
    await options.queryFn?.({ signal: new AbortController().signal } as never)
    expect(readSessionFeed).toHaveBeenCalledWith({
      sessionId: 'session-new',
      subagentId: null,
      revision: null,
    })
  } finally {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow })
  }
})

describe('caching and retrying the Session feed read', () => {
  test('removes an inactive transcript as soon as its observer switches away', async () => {
    const client = new QueryClient()
    const options = {
      ...sessionFeedQuery(client, 'session-a', null),
      queryFn: async () => ({ sessionId: 'session-a', rows: [] }),
    }
    const observer = new QueryObserver(client, options)
    const unsubscribe = observer.subscribe(() => {})

    await observer.refetch()
    unsubscribe()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(client.getQueryData(options.queryKey)).toBeUndefined()
  })

  test('starts a new read when retrying a pending Feed with no cached data', async () => {
    const client = new QueryClient()
    const pendingRead = new Promise<never>(() => {})
    const readSessionFeed = vi
      .fn()
      .mockResolvedValueOnce(pendingRead)
      .mockResolvedValueOnce(feedReply('session-a', 'recovered-feed', 'recovered'))
    const originalWindow = globalThis.window
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { argo: { cancelSessionFeed: vi.fn(), readSessionFeed } },
    })
    const options = sessionFeedQuery(client, 'session-a', null)
    const observer = new QueryObserver(client, options)
    const unsubscribe = observer.subscribe(() => {})

    expect(readSessionFeed).toHaveBeenCalledTimes(1)
    try {
      await retrySessionFeed(client, options.queryKey, () => observer.refetch())
      expect(readSessionFeed).toHaveBeenCalledTimes(2)
    } finally {
      unsubscribe()
      Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow })
    }
  })
})
