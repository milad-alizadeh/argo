import { expect, test } from 'bun:test'
import { QueryClient } from '@tanstack/react-query'
import { sessionRow } from './session-fixtures'
import {
  invalidateSessionList,
  markSessionRead,
  sessionListQueryKey,
  sessionListsQueryKey,
} from './session-queries'

test('coalesces one watch event into one Session list invalidation', async () => {
  const queryClient = new QueryClient()
  let invalidations = 0
  queryClient.invalidateQueries = async (filters) => {
    expect(filters).toEqual({ queryKey: sessionListsQueryKey })
    invalidations += 1
  }

  const first = invalidateSessionList(queryClient)
  const second = invalidateSessionList(queryClient)
  await Promise.all([first, second])

  expect(invalidations).toBe(1)
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
  queryClient.setQueryData(sessionListQueryKey('project-1'), {
    pages: [
      {
        sessions: [session],
        total: 1,
        nextPage: null,
        historyComplete: true,
      },
    ],
    pageParams: [null],
  })

  markSessionRead(queryClient, 'resumed', ['retired'])

  const sessionList = queryClient.getQueryData<{ pages: { sessions: (typeof session)[] }[] }>([
    ...sessionListQueryKey('project-1'),
  ])
  expect(sessionList?.pages[0]?.sessions).toHaveLength(1)
  expect(sessionList?.pages[0]?.sessions[0]?.unread).toBe(false)
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
  queryClient.setQueryData(sessionListQueryKey('project-1'), {
    pages: [{ sessions: [retired] }],
    pageParams: [null],
  })

  markSessionRead(queryClient, 'resumed', ['retired'])

  const sessionList = queryClient.getQueryData<{ pages: { sessions: (typeof retired)[] }[] }>([
    ...sessionListQueryKey('project-1'),
  ])
  expect(sessionList?.pages[0]?.sessions[0]?.unread).toBe(false)
})
