import { expect, test } from 'bun:test'
import { QueryClient } from '@tanstack/react-query'
import { sessionRow } from '@/mocks/sessions/session-rows'
import type { Session } from '../types'
import {
  applySessionListChange,
  type SessionListInput,
  sessionListMatches,
  sessionListQueryKey,
} from './session-list-query'

type Pages = { pages: { total: number; rows: Session[] }[]; pageParams: number[] }

const active: SessionListInput = { projectId: 'project-1', filter: 'active', search: '' }

function session(id: string, createdAt: string, overrides: Partial<Session> = {}): Session {
  return sessionRow({
    id,
    cwd: null,
    posture: null,
    status: 'idle',
    title: null,
    createdAt: `2026-09-30T10:00:0${createdAt}.000Z`,
    ...overrides,
  })
}

function cached(input: SessionListInput, pages: Session[][], total: number) {
  const client = new QueryClient()
  client.setQueryData<Pages>(sessionListQueryKey(input), {
    pages: pages.map((rows) => ({ total, rows })),
    pageParams: pages.map((_, index) => index * 2),
  })
  const read = () => client.getQueryData<Pages>(sessionListQueryKey(input))
  return {
    client,
    ids: () => read()?.pages.map((page) => page.rows.map((row) => row.id)),
    total: () => read()?.pages[0]?.total,
  }
}

test('replaces a changed row in place and keeps every other row object', () => {
  const first = session('first', '3')
  const second = session('second', '2')
  const list = cached(active, [[first, second]], 2)

  applySessionListChange(list.client, [{ ...second, status: 'running' }])

  const rows = list.client.getQueryData<Pages>(sessionListQueryKey(active))?.pages[0]?.rows
  expect(rows?.[0]).toBe(first)
  expect(rows?.[1]?.status).toBe('running')
  expect(list.total()).toBe(2)
})

test('adds a new Session at its place in the order and counts it', () => {
  const list = cached(active, [[session('newer', '5'), session('older', '1')]], 2)

  applySessionListChange(list.client, [session('middle', '3')])

  expect(list.ids()).toEqual([['newer', 'middle', 'older']])
  expect(list.total()).toBe(3)
})

test('places a new Session between two loaded pages in order', () => {
  const list = cached(active, [[session('a', '9'), session('b', '8')], [session('c', '4')]], 4)

  applySessionListChange(list.client, [session('new', '5')])

  expect(list.ids()?.flat()).toEqual(['a', 'b', 'new', 'c'])
})

test('leaves an unloaded Session and the total for the page that reads it', () => {
  const list = cached(active, [[session('a', '9'), session('b', '8')]], 5)

  applySessionListChange(list.client, [session('old', '1')])

  expect(list.ids()).toEqual([['a', 'b']])
  expect(list.total()).toBe(5)
})

test('drops an archived Session from the active list and adds it to the archived one', () => {
  const kept = session('kept', '5')
  const moved = session('moved', '3')
  const activeList = cached(active, [[kept, moved]], 2)
  const archived: SessionListInput = { ...active, filter: 'archived' }
  const archivedList = cached(archived, [[]], 0)
  archivedList.client.setQueryData(
    sessionListQueryKey(active),
    activeList.client.getQueryData(sessionListQueryKey(active)),
  )

  applySessionListChange(archivedList.client, [{ ...moved, archived: true }])

  const activeIds = archivedList.client
    .getQueryData<Pages>(sessionListQueryKey(active))
    ?.pages[0]?.rows.map((row) => row.id)
  expect(activeIds).toEqual(['kept'])
  expect(archivedList.ids()).toEqual([['moved']])
  expect(archivedList.total()).toBe(1)
})

test('keeps another Project and a search it no longer matches out of the list', () => {
  const searched: SessionListInput = { ...active, search: 'LOGIN' }
  const list = cached(searched, [[session('login', '5', { customTitle: 'Fix login' })]], 1)

  applySessionListChange(list.client, [
    session('elsewhere', '6', { customTitle: 'login', projectId: 'project-2' }),
    session('login', '5', { customTitle: 'Fix signup' }),
    session('preview', '4', { preview: 'the Login page' }),
  ])

  expect(list.ids()).toEqual([['preview']])
  expect(list.total()).toBe(1)
})

test('orders a lower sort order first, before a newer Session', () => {
  const list = cached(active, [[session('newest', '9')]], 1)

  applySessionListChange(list.client, [session('pinned', '1', { sortOrder: -1 })])

  expect(list.ids()).toEqual([['pinned', 'newest']])
})

test('drops an unloaded Session that leaves the list without changing the total', () => {
  const list = cached(active, [[session('a', '9'), session('b', '8')]], 5)

  applySessionListChange(list.client, [{ ...session('old', '1'), archived: true }])

  expect(list.ids()).toEqual([['a', 'b']])
  expect(list.total()).toBe(5)
})

test('folds case in search the way SQLite does, ASCII letters only', () => {
  const search = (text: string) => ({ ...active, search: text })
  const row = { ...session('umlaut', '5'), customTitle: 'Über Fix' }

  expect(sessionListMatches(row, search('über'))).toBe(false)
  expect(sessionListMatches(row, search('Über fix'))).toBe(true)
})
