import { type Dispatch, type SetStateAction, useEffect, useState } from 'react'
import type { SessionLiveEvent, SessionLiveUpdate } from '@/domains/sessions/api/session-live-event'
import { queryClient, trpcClient } from '@/platform/renderer/trpc-client'
import { sessionFeedQueryKey, sessionPermissionQueryKey } from '../session-queries'
import type { SessionId } from '../types'

type LiveFeedState = {
  sessionId: SessionId
  hasChannel: boolean
  events: SessionLiveEvent[]
}

function applyLiveUpdate({
  selected,
  update,
  cursor,
  setState,
}: {
  selected: SessionId
  update: SessionLiveUpdate
  cursor: number
  setState: Dispatch<SetStateAction<LiveFeedState | null>>
}): number {
  switch (update.type) {
    case 'ready':
      setState((current) => ({
        sessionId: selected,
        hasChannel: update.live,
        events: current?.sessionId === selected ? current.events : [],
      }))
      return cursor
    case 'event':
      if (update.event.sequence <= cursor) return cursor
      setState((current) => ({
        sessionId: selected,
        hasChannel: current?.sessionId === selected ? current.hasChannel : true,
        events: [...(current?.sessionId === selected ? current.events : []), update.event].slice(
          -500,
        ),
      }))
      if (update.event.type === 'status' && update.event.status === 'idle')
        void queryClient.invalidateQueries({ queryKey: sessionFeedQueryKey(selected) })
      if (update.event.type === 'permission')
        void queryClient.invalidateQueries({ queryKey: sessionPermissionQueryKey(selected) })
      return update.event.sequence
    case 'expired':
      setState((current) => ({
        sessionId: selected,
        hasChannel: current?.hasChannel ?? false,
        events: [],
      }))
      void queryClient.invalidateQueries({ queryKey: sessionFeedQueryKey(selected) })
      return update.cursor
  }
}

export function useLiveFeedEvents(sessionId: SessionId | null): LiveFeedState | null {
  const [state, setState] = useState<LiveFeedState | null>(null)
  useEffect(() => {
    if (sessionId === null) return
    const selected = sessionId
    let stopped = false
    let cursor = 0
    let reconnect: ReturnType<typeof setTimeout> | null = null
    let subscription: { unsubscribe: () => void } | null = null
    const connect = () => {
      subscription = trpcClient.sessionLiveEvents.subscribe(
        { sessionId: selected, cursor },
        {
          onData(update) {
            cursor = applyLiveUpdate({ selected, update, cursor, setState })
          },
          onError() {
            if (stopped) return
            setState((current) =>
              current?.sessionId === selected ? { ...current, hasChannel: false } : current,
            )
            reconnect = setTimeout(connect, 1000)
          },
        },
      )
    }
    connect()
    return () => {
      stopped = true
      subscription?.unsubscribe()
      if (reconnect !== null) clearTimeout(reconnect)
    }
  }, [sessionId])
  return state?.sessionId === sessionId ? state : null
}
