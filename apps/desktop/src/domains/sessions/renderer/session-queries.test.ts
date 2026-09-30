import { expect, test } from 'bun:test'
import { QueryClient } from '@tanstack/react-query'
import { sessionRow } from '@/mocks/sessions/session-rows'
import { markSessionRead } from './session-queries'
import { type SessionRosterState, sessionRosterQueryKey } from './session-roster'
import type { Session } from './types'

const key = sessionRosterQueryKey({ projectId: 'project-1', search: '' })

function rosterOf(rows: Session[]): SessionRosterState {
  return { list: { type: 'list', pages: 1, pageSize: 30, total: rows.length, rows }, failed: false }
}

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
  queryClient.setQueryData(key, rosterOf([session]))

  markSessionRead(queryClient, 'resumed', ['retired'])

  const roster = queryClient.getQueryData<SessionRosterState>(key)
  expect(roster?.list?.rows).toHaveLength(1)
  expect(roster?.list?.rows[0]?.unread).toBe(false)
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
  queryClient.setQueryData(key, rosterOf([retired]))

  markSessionRead(queryClient, 'resumed', ['retired'])

  expect(queryClient.getQueryData<SessionRosterState>(key)?.list?.rows[0]?.unread).toBe(false)
})
