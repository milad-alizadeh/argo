import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { describe, expect, test, vi } from 'vitest'
import { retrySessionFeed, sessionFeedQuery } from './sessionFeedQuery'

describe('sessionFeedQuery', () => {
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
    const readSessionFeed = vi.fn().mockResolvedValueOnce(pendingRead).mockResolvedValueOnce({
      version: 1,
      type: 'session.feed.read',
      requestId: 'recovered-feed',
      sessionId: 'session-a',
      chainId: 'session-a',
      revision: 'recovered',
      rows: [],
    })
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
