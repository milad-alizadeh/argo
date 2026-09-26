import { type InfiniteData, InfiniteQueryObserver, QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { SessionListPage } from '../../types'
import { sessionListQuery } from './session-list-query'

const originalWindow = globalThis.window

type SessionListObserver = {
  fetchNextPage: () => Promise<unknown>
  getCurrentResult: () => { data: InfiniteData<SessionListPage> | undefined }
  refetch: () => Promise<unknown>
}

function page(
  pageNumber: number,
  title: string,
  options: { total?: number; updatedAt?: number } = {},
) {
  return {
    page: pageNumber,
    pageSize: 1,
    total: options.total ?? 2,
    rows: [
      {
        id: `00000000-0000-4000-8000-00000000000${pageNumber}`,
        retiredIds: [],
        harness: 'claude',
        posture: null,
        title: { text: title, source: 'summarised' as const },
        status: 'unknown' as const,
        entry: null,
        cwd: '/work/argo',
        branch: null,
        updatedAt: new Date(options.updatedAt ?? pageNumber).toISOString(),
        unreadableLines: 0 as const,
        originUnread: false as const,
        turnStartedAt: null,
        activity: null,
        plan: null,
        subagents: [],
        shell: [],
        pullRequest: null,
        ticket: null,
        archived: false as const,
        unread: false as const,
        turnConfiguration: { model: null, effort: null, mode: null },
      },
    ],
  }
}

async function observeSessionList(read: (observer: SessionListObserver) => Promise<void>) {
  const client = new QueryClient()
  const options = sessionListQuery(true)
  const observer = new InfiniteQueryObserver(client, options)
  const unsubscribe = observer.subscribe(() => {})
  await read(observer)
  unsubscribe()
  return { client, options }
}

function withSessionPages(...pages: ReturnType<typeof page>[]) {
  const trpc = vi.fn()
  for (const result of pages) trpc.mockResolvedValueOnce({ result: { data: result } })
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { argo: { trpc } },
  })
  return trpc
}

afterEach(() => {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow })
})

describe('reading numbered Session pages', () => {
  test('requests consecutive page numbers and stops at the total count', async () => {
    const trpc = withSessionPages(page(1, 'First page'), page(2, 'Second page'))
    let titles: string[] = []

    await observeSessionList(async (observer) => {
      await observer.refetch()
      await observer.fetchNextPage()
      titles =
        observer
          .getCurrentResult()
          .data?.pages.flatMap((result) =>
            result.sessions.map((session) => session.title?.text ?? ''),
          ) ?? []
    })

    expect(trpc).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ path: 'sessions.list', input: { page: 1, pageSize: 30 } }),
    )
    expect(trpc).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ path: 'sessions.list', input: { page: 2, pageSize: 30 } }),
    )
    expect(titles).toEqual(['First page', 'Second page'])
  })

  test('keeps the published list when an equivalent saved page is read again', async () => {
    withSessionPages(page(1, 'Saved title'), page(1, 'Saved title'))
    let first: InfiniteData<SessionListPage> | undefined
    let second: InfiniteData<SessionListPage> | undefined

    await observeSessionList(async (observer) => {
      await observer.refetch()
      first = observer.getCurrentResult().data
      await observer.refetch()
      second = observer.getCurrentResult().data
    })

    expect(second).toBe(first)
  })

  test('converts persisted timestamps without exposing database-only identity', async () => {
    withSessionPages(page(1, 'Saved title', { total: 1, updatedAt: 1_000 }))
    let result: SessionListPage | undefined

    await observeSessionList(async (observer) => {
      await observer.refetch()
      result = observer.getCurrentResult().data?.pages[0]
    })

    expect(result?.sessions[0]).toMatchObject({
      id: '00000000-0000-4000-8000-000000000001',
      title: { text: 'Saved title', source: 'summarised' },
      updatedAt: '1970-01-01T00:00:01.000Z',
    })
    expect(result).toMatchObject({ total: 1, nextPage: null })
  })
})
