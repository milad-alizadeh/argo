import { type Dispatch, type SetStateAction, useEffect, useState } from 'react'
import type { SessionLiveUpdate } from '@/domains/sessions/api/session-live-event'
import { queryClient, trpcClient } from '@/platform/renderer/trpc-client'
import { sessionFeedQueryKey, sessionPermissionQueryKey } from '../session-queries'
import type { SessionId } from '../types'
import {
  emptyLiveEventBuffer,
  type LiveEventBuffer,
  retainLiveEvent,
} from './model/live-event-buffer'

type LiveFeedState = LiveEventBuffer & {
  sessionId: SessionId
  hasChannel: boolean
  ready: boolean
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
        ...(current?.sessionId === selected ? current : emptyLiveEventBuffer()),
        sessionId: selected,
        hasChannel: update.live,
        ready: true,
      }))
      return cursor
    case 'event':
      if (update.event.sequence <= cursor) return cursor
      setState((current) => ({
        ...retainLiveEvent(current?.sessionId === selected ? current : null, update.event),
        sessionId: selected,
        hasChannel: current?.sessionId === selected ? current.hasChannel : true,
        ready: true,
      }))
      if (update.event.type === 'status' && update.event.status === 'idle')
        void queryClient.invalidateQueries({ queryKey: sessionFeedQueryKey(selected) })
      if (update.event.type === 'permission')
        void queryClient.invalidateQueries({ queryKey: sessionPermissionQueryKey(selected) })
      return update.event.sequence
    case 'expired':
      setState((current) => ({
        ...emptyLiveEventBuffer(),
        sessionId: selected,
        hasChannel: current?.hasChannel ?? false,
        ready: true,
      }))
      void queryClient.invalidateQueries({ queryKey: sessionFeedQueryKey(selected) })
      return update.cursor
    case 'invalidated':
      void queryClient.invalidateQueries({ queryKey: ['sessions', 'feed', selected] })
      return cursor
  }
}

function useFocusRefresh(sessionId: SessionId | null) {
  useEffect(() => {
    if (sessionId === null) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const refresh = () => {
      if (timer !== null) clearTimeout(timer)
      timer = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ['sessions', 'feed', sessionId] })
      }, 250)
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      if (timer !== null) clearTimeout(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [sessionId])
}

export function useLiveFeedEvents(sessionId: SessionId | null): LiveFeedState | null {
  const [state, setState] = useState<LiveFeedState | null>(null)
  useFocusRefresh(sessionId)
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
            setState((current) => ({
              ...(current?.sessionId === selected ? current : emptyLiveEventBuffer()),
              sessionId: selected,
              hasChannel: false,
              ready: true,
            }))
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
