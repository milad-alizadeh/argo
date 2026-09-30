import { expect, test } from 'bun:test'
import { QueryClient } from '@tanstack/react-query'
import { sessionRow } from '@/mocks/sessions/session-rows'
import {
  type SessionListWindowState,
  sessionListWindowQueryKey,
} from './session-list/session-list-window'
import { markSessionRead } from './session-queries'
import type { Session } from './types'

const key = sessionListWindowQueryKey({ projectId: 'project-1', search: '', view: 'view-1' })

function rosterOf(rows: Session[]): SessionListWindowState {
  return { window: { total: rows.length, offset: 0, rows }, failed: false }
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

  const roster = queryClient.getQueryData<SessionListWindowState>(key)
  expect(roster?.window?.rows).toHaveLength(1)
  expect(roster?.window?.rows[0]?.unread).toBe(false)
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

  expect(queryClient.getQueryData<SessionListWindowState>(key)?.window?.rows[0]?.unread).toBe(false)
})
