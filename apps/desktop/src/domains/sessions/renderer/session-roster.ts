import { skipToken, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { queryClient, type RouterInputs, trpcClient } from '@/platform/renderer/trpc-client'
import type { SessionListResult, SessionListUpdate } from './types'

export type SessionRosterState = { list: SessionListResult | null; failed: boolean }
type RosterInput = Pick<RouterInputs['sessionList'], 'projectId' | 'search'>

export const sessionRosterPathKey = ['sessions', 'roster'] as const
export const sessionRosterQueryKey = ({ projectId, search }: Required<RosterInput>) =>
  [...sessionRosterPathKey, projectId, search] as const

function applyRosterUpdate(
  state: SessionRosterState | undefined,
  update: SessionListUpdate,
): SessionRosterState | undefined {
  switch (update.type) {
    case 'list':
      return { list: update, failed: false }
    case 'row': {
      if (state?.list == null) return state
      const rows = state.list.rows.map((row) => (row.id === update.row.id ? update.row : row))
      return { ...state, list: { ...state.list, rows } }
    }
  }
}

type Follower = { readers: Map<symbol, number>; pages: number; stop: () => void }
const followers = new Map<string, Follower>()

function subscribe(input: Required<RosterInput>, pages: number): () => void {
  const queryKey = sessionRosterQueryKey(input)
  const subscription = trpcClient.sessionList.subscribe(
    { ...input, pages },
    {
      onData: (update) =>
        queryClient.setQueryData<SessionRosterState>(queryKey, (state) =>
          applyRosterUpdate(state, update),
        ),
      onError: () =>
        queryClient.setQueryData<SessionRosterState>(queryKey, (state) => ({
          list: state?.list ?? null,
          failed: true,
        })),
    },
  )
  return () => subscription.unsubscribe()
}

// The window every reader of one roster shares is the largest any of them has asked for.
function refollow(follower: Follower, input: Required<RosterInput>) {
  const pages = Math.max(...follower.readers.values())
  if (pages === follower.pages) return
  follower.stop()
  follower.pages = pages
  follower.stop = subscribe(input, pages)
}

// One subscription per roster, however many components read it.
function follow(input: Required<RosterInput>, reader: symbol, pages: number): () => void {
  const key = JSON.stringify(sessionRosterQueryKey(input))
  const follower = followers.get(key) ?? { readers: new Map(), pages: 0, stop: () => {} }
  followers.set(key, follower)
  follower.readers.set(reader, pages)
  refollow(follower, input)
  return () => {
    follower.readers.delete(reader)
    if (follower.readers.size > 0) return refollow(follower, input)
    follower.stop()
    followers.delete(key)
  }
}

export function useSessionRoster(input: Required<RosterInput>, pages: number, enabled: boolean) {
  const [reader] = useState(() => Symbol('Session roster reader'))
  const { projectId, search } = input
  useEffect(() => {
    if (!enabled) return
    return follow({ projectId, search }, reader, pages)
  }, [enabled, pages, projectId, reader, search])
  return useQuery<SessionRosterState>({
    queryKey: sessionRosterQueryKey(input),
    queryFn: skipToken,
    staleTime: Number.POSITIVE_INFINITY,
    placeholderData: (previous, previousQuery) =>
      previous?.failed === false &&
      previousQuery?.queryKey[sessionRosterPathKey.length] === projectId
        ? previous
        : undefined,
  }).data
}
