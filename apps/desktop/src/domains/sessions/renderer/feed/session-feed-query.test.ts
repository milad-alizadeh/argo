import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { describe, expect, test, vi } from 'vitest'
import { retrySessionFeed, sessionFeedQuery } from './session-feed-query'

function feedReply(sessionId: string, requestId: string, revision: string) {
  return {
    version: 1,
    type: 'session.feed.read' as const,
    requestId,
    sessionId,
    chainId: sessionId,
    revision,
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

async function until(ready: () => boolean) {
  while (!ready()) await new Promise((resolve) => setTimeout(resolve, 0))
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

test('a failed refresh keeps the known snapshot and Retry reads it again', async () => {
  const client = new QueryClient()
  const known = feedReply('session-a', 'known', 'known')
  const recovered = feedReply('session-a', 'recovered', 'recovered')
  const trpc = vi
    .fn()
    .mockResolvedValueOnce({ result: { data: known } })
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ result: { data: recovered } })
  const options = sessionFeedQuery('session-a', null)
  await withTrpc(trpc, async () => {
    const observer = new QueryObserver(client, options)
    const unsubscribe = observer.subscribe(() => {})
    await until(() => observer.getCurrentResult().data !== undefined)
    expect(observer.getCurrentResult().data).toMatchObject(known)
    await client.invalidateQueries({ queryKey: options.queryKey })
    expect(observer.getCurrentResult()).toMatchObject({
      data: known,
      error: { code: 'vendor-history-unavailable' },
    })
    await retrySessionFeed(client, options.queryKey, () => observer.refetch())
    expect(observer.getCurrentResult()).toMatchObject({ data: recovered, error: null })
    unsubscribe()
  })
})

test('a late read for Session A never lands in the Session B snapshot', async () => {
  const client = new QueryClient()
  let finishA: (value: unknown) => void = () => {}
  const trpc = vi.fn((request: { input: { sessionId: string } }) =>
    request.input.sessionId === 'session-a'
      ? new Promise((resolve) => {
          finishA = resolve
        })
      : Promise.resolve({ result: { data: feedReply('session-b', 'b', 'b') } }),
  )
  await withTrpc(trpc, async () => {
    const observerA = new QueryObserver(client, sessionFeedQuery('session-a', null))
    const stopA = observerA.subscribe(() => {})
    stopA()
    const optionsB = sessionFeedQuery('session-b', null)
    const observerB = new QueryObserver(client, optionsB)
    const stopB = observerB.subscribe(() => {})
    await until(() => observerB.getCurrentResult().data !== undefined)
    finishA({ result: { data: feedReply('session-a', 'late-a', 'late-a') } })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(client.getQueryData(optionsB.queryKey)).toMatchObject({
      sessionId: 'session-b',
      revision: 'b',
    })
    stopB()
  })
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
