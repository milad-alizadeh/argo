import { expect, test } from 'bun:test'
import { QueryClient } from '@tanstack/react-query'
import { sessionRow } from '@/mocks/sessions/session-rows'
import { sessionListQueryKey } from './session-list/session-list-query'
import { markSessionRead } from './session-queries'
import type { Session } from './types'

const key = sessionListQueryKey({ projectId: 'project-1', filter: 'active', search: '' })

function listOf(rows: Session[]) {
  return { pages: [{ total: rows.length, rows }], pageParams: [0] }
}

const rowsOf = (client: QueryClient) =>
  client.getQueryData<ReturnType<typeof listOf>>(key)?.pages[0]?.rows

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
  queryClient.setQueryData(key, listOf([session]))

  markSessionRead(queryClient, 'resumed', ['retired'])

  expect(rowsOf(queryClient)).toHaveLength(1)
  expect(rowsOf(queryClient)?.[0]?.unread).toBe(false)
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
  queryClient.setQueryData(key, listOf([retired]))

  markSessionRead(queryClient, 'resumed', ['retired'])

  expect(rowsOf(queryClient)?.[0]?.unread).toBe(false)
})
