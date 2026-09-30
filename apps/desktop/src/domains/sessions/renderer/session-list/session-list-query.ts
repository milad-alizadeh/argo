import { type InfiniteData, type QueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { queryClient, type RouterInputs, trpcClient } from '@/platform/renderer/trpc-client'
import type { Session, SessionListResult } from '../types'

export type SessionListInput = Required<
  Pick<RouterInputs['sessionList'], 'projectId' | 'filter' | 'search'>
>
type SessionListData = InfiniteData<SessionListResult, number>

const PAGE_SIZE = 30

export const sessionListPathKey = ['sessions', 'list'] as const
export const sessionListQueryKey = (input: SessionListInput) =>
  [...sessionListPathKey, input] as const

// The same test the list query's SQL makes, so a changed row lands where a read would put it.
const filterKeeps = {
  active: (session) => !session.archived,
  archived: (session) => session.archived,
  all: () => true,
} satisfies Record<SessionListInput['filter'], (session: Session) => boolean>

// SQLite's lower() folds ASCII letters only.
const sqliteLower = (text: string) => text.replace(/[A-Z]/g, (letter) => letter.toLowerCase())

export function sessionListMatches(session: Session, input: SessionListInput): boolean {
  if (session.projectId !== input.projectId) return false
  if (!filterKeeps[input.filter](session)) return false
  const needle = sqliteLower(input.search.trim())
  if (needle === '') return true
  return [session.customTitle, session.preview].some((text) =>
    sqliteLower(text ?? '').includes(needle),
  )
}

// Lower sort order first, then newest, with the Argo ID breaking ties.
function listsBefore(left: Session, right: Session): boolean {
  if (left.sortOrder !== right.sortOrder) return left.sortOrder < right.sortOrder
  if (left.createdAt !== right.createdAt) return left.createdAt > right.createdAt
  return left.id < right.id
}

// Replaces, moves, adds or drops one changed row in the loaded pages. A row that sorts past the
// last loaded row waits for the page that reads it, and an unloaded row leaves the total alone.
function placeSession(data: SessionListData, input: SessionListInput, session: Session) {
  const present = data.pages.some((page) => page.rows.some((row) => row.id === session.id))
  const others = (data.pages[0]?.total ?? 0) - (present ? 1 : 0)
  const pages = data.pages.map((page) => ({
    total: others,
    rows: page.rows.filter((row) => row.id !== session.id),
  }))
  if (!sessionListMatches(session, input)) return { ...data, pages }
  const remaining = pages.flatMap((page) => page.rows)
  let position = remaining.findIndex((row) => listsBefore(session, row))
  if (position === -1 && remaining.length >= others) position = remaining.length
  const total = present || position !== -1 ? others + 1 : others
  for (const page of pages) {
    page.total = total
    if (position !== -1 && position <= page.rows.length) {
      page.rows.splice(position, 0, session)
      position = -1
    } else if (position !== -1) position -= page.rows.length
  }
  return { ...data, pages }
}

// Writes the changed rows into every loaded Session List, so no list is read again.
export function applySessionListChange(client: QueryClient, sessions: readonly Session[]) {
  for (const query of client.getQueryCache().findAll({ queryKey: sessionListPathKey })) {
    const input = query.queryKey[sessionListPathKey.length] as SessionListInput
    client.setQueryData<SessionListData>(query.queryKey, (data) =>
      data === undefined
        ? data
        : sessions.reduce((placed, session) => placeSession(placed, input, session), data),
    )
  }
}

// One change subscription however many lists are mounted, because main reads a working Feed for it.
let readers = 0
let stopChanges = () => {}
function followChanges(): () => void {
  readers += 1
  if (readers === 1) {
    const subscription = trpcClient.sessionListChanged.subscribe(undefined, {
      onData: ({ rows }) => applySessionListChange(queryClient, rows),
    })
    stopChanges = () => subscription.unsubscribe()
  }
  return () => {
    readers -= 1
    if (readers === 0) stopChanges()
  }
}

export function useSessionListQuery(input: SessionListInput, enabled: boolean) {
  useEffect(() => (enabled ? followChanges() : undefined), [enabled])
  return useInfiniteQuery({
    queryKey: sessionListQueryKey(input),
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
    // A new search or filter keeps the Project's rows on screen until its first page lands.
    placeholderData: (previous, previousQuery) =>
      (previousQuery?.queryKey[sessionListPathKey.length] as SessionListInput | undefined)
        ?.projectId === input.projectId
        ? previous
        : undefined,
    initialPageParam: 0,
    // The next offset is the rows loaded, so a row placed or dropped here moves it too.
    getNextPageParam: (last: SessionListResult, pages: SessionListResult[]) => {
      const loaded = pages.reduce((sum, page) => sum + page.rows.length, 0)
      return loaded < last.total ? loaded : undefined
    },
    queryFn: ({ pageParam }) =>
      trpcClient.sessionList.query({ ...input, offset: pageParam, limit: PAGE_SIZE }),
  })
}
