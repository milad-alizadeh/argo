import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { describe, expect, test, vi } from 'vitest'
import { refreshSessionFeed, retrySessionFeed, sessionFeedQuery } from './session-feed-query'

function feedReply(sessionId: string, requestId: string, revision: string) {
  return {
    version: 1,
    type: 'session.feed.read' as const,
    requestId,
    sessionId,
    chainId: sessionId,
    revision,
    olderCursor: null,
    content: [],
  }
}

async function withTrpc<T>(trpc: ReturnType<typeof vi.fn>, run: () => Promise<T>): Promise<T> {
  const originalWindow = globalThis.window
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { argo: { trpc } },
  })
  try {
    return await run()
  } finally {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow })
  }
}

test('reads a newly started Session by its real identifier', async () => {
  const feed = feedReply('session-new', 'new-session-feed', 'initial')
  const trpc = vi.fn().mockResolvedValue({ result: { data: feed } })
  const options = sessionFeedQuery('session-new', null)
  await withTrpc(trpc, async () => {
    await options.queryFn?.({ signal: new AbortController().signal } as never)
    expect(trpc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'sessionFeedRead', type: 'query' }),
    )
  })
})

test('reads the feed through tRPC without legacy preload methods', async () => {
  const feed = feedReply('session-a', 'feed-read', 'revision-1')
  const trpc = vi.fn().mockResolvedValue({ result: { data: feed } })
  const options = sessionFeedQuery('session-a', null)
  await withTrpc(trpc, async () => {
    await expect(
      options.queryFn?.({ signal: new AbortController().signal } as never),
    ).resolves.toMatchObject({
      sessionId: 'session-a',
    })
    expect(trpc).toHaveBeenCalledOnce()
  })
})

test('refreshes only the Session whose older cursor expired', async () => {
  const client = new QueryClient()
  const sessionA = feedReply('session-a', 'a-old', 'a-old')
  const sessionB = feedReply('session-b', 'b-current', 'b-current')
  client.setQueryData(sessionFeedQuery('session-a', null).queryKey, sessionA)
  client.setQueryData(sessionFeedQuery('session-b', null).queryKey, sessionB)
  const refreshedA = { ...feedReply('session-a', 'a-new', 'a-new'), olderCursor: 'a-next' }
  const trpc = vi.fn().mockResolvedValue({ result: { data: refreshedA } })

  await withTrpc(trpc, async () => {
    await refreshSessionFeed(client, 'session-a', null)
  })

  expect(trpc).toHaveBeenCalledWith(
    expect.objectContaining({
      path: 'sessionFeedRead',
      type: 'query',
      input: expect.objectContaining({ sessionId: 'session-a' }),
    }),
  )
  expect(client.getQueryData(sessionFeedQuery('session-a', null).queryKey)).toMatchObject({
    revision: 'a-new',
    olderCursor: 'a-next',
  })
  expect(client.getQueryData(sessionFeedQuery('session-b', null).queryKey)).toBe(sessionB)
})

test('keeps history reads event-driven for both live and external Sessions', () => {
  expect(sessionFeedQuery('session-a', null).refetchInterval).toBeUndefined()
  expect(sessionFeedQuery('session-a', null, false).enabled).toBe(false)
  expect(sessionFeedQuery('session-a', 'child-1').refetchInterval).toBeUndefined()
})

describe('caching and retrying the Session feed read', () => {
  test('removes an inactive transcript as soon as its observer switches away', async () => {
    const client = new QueryClient()
    const options = {
      ...sessionFeedQuery('session-a', null),
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
    const trpc = vi
      .fn()
      .mockImplementationOnce(() => pendingRead)
      .mockResolvedValueOnce({
        result: { data: feedReply('session-a', 'recovered-feed', 'recovered') },
      })
    const options = sessionFeedQuery('session-a', null)
    await withTrpc(trpc, async () => {
      const observer = new QueryObserver(client, options)
      const unsubscribe = observer.subscribe(() => {})
      expect(trpc).toHaveBeenCalledTimes(1)
      await retrySessionFeed(client, options.queryKey, () => observer.refetch())
      expect(trpc).toHaveBeenCalledTimes(2)
      unsubscribe()
    })
  })
})
