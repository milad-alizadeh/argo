import { expect, test } from 'bun:test'
import { QueryClient } from '@tanstack/react-query'
import { trpc } from '@/platform/renderer/trpc-client'
import { sessionRow } from './session-fixtures'
import { invalidateSessionList, markSessionRead } from './session-queries'

const sessionListPathKey = trpc.sessions.list.pathKey()

test('coalesces one watch event into current and archived Session list invalidations', async () => {
  const queryClient = new QueryClient()
  const invalidations: unknown[] = []
  queryClient.invalidateQueries = async (filters) => {
    invalidations.push(filters)
  }

  const first = invalidateSessionList(queryClient)
  const second = invalidateSessionList(queryClient)
  await Promise.all([first, second])

  expect(invalidations).toEqual([
    { queryKey: sessionListPathKey },
    { queryKey: ['sessions', 'archive'] },
  ])
})

test('opening a Session clears unread state without dropping a loaded row', () => {
  const queryClient = new QueryClient()
  const session = sessionRow({
    id: 'resumed',
    cwd: null,
    posture: 'live',
    status: 'idle',
    title: null,
    retiredIds: ['retired'],
    unread: true,
  })
  const key = trpc.sessions.list.infiniteQueryKey({ projectId: 'project-1', search: '' })
  queryClient.setQueryData(key, {
    pages: [
      {
        page: 1,
        pageSize: 30,
        rows: [session],
        total: 1,
      },
    ],
    pageParams: [null],
  })

  markSessionRead(queryClient, 'resumed', ['retired'])

  const sessionList = queryClient.getQueryData<{ pages: { rows: (typeof session)[] }[] }>(key)
  expect(sessionList?.pages[0]?.rows).toHaveLength(1)
  expect(sessionList?.pages[0]?.rows[0]?.unread).toBe(false)
})

test('opening a resumed Session clears its retired row in every cached Session list', () => {
  const queryClient = new QueryClient()
  const retired = sessionRow({
    id: 'retired',
    cwd: null,
    posture: 'live',
    status: 'idle',
    title: null,
    unread: true,
  })
  const key = trpc.sessions.list.infiniteQueryKey({ projectId: 'project-1', search: '' })
  queryClient.setQueryData(key, {
    pages: [{ page: 1, pageSize: 30, rows: [retired], total: 1 }],
    pageParams: [null],
  })

  markSessionRead(queryClient, 'resumed', ['retired'])

  const sessionList = queryClient.getQueryData<{ pages: { rows: (typeof retired)[] }[] }>(key)
  expect(sessionList?.pages[0]?.rows[0]?.unread).toBe(false)
})
