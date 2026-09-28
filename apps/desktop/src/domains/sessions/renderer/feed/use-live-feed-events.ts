import { type Dispatch, type SetStateAction, useEffect, useState } from 'react'
import {
  SESSION_LIVE_REPLAY_BYTE_LIMIT,
  type SessionLiveUpdate,
} from '@/domains/sessions/api/session-live-event'
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
  subagentId: string | null
  hasChannel: boolean
  ready: boolean
}

type LiveUpdateTarget = {
  selected: SessionId
  subagentId: string | null
  cursor: number
  // Events missed while disconnected may have settled into vendor history.
  reconnected: boolean
  setState: Dispatch<SetStateAction<LiveFeedState | null>>
}

function applyReady(
  { selected, subagentId, cursor, reconnected, setState }: LiveUpdateTarget,
  update: Extract<SessionLiveUpdate, { type: 'ready' }>,
): number {
  if (update.replayExpired || reconnected)
    void queryClient.invalidateQueries({ queryKey: sessionFeedQueryKey(selected, subagentId) })
  setState((current) => ({
    ...(!update.replayExpired &&
    current?.sessionId === selected &&
    current.subagentId === subagentId
      ? current
      : emptyLiveEventBuffer()),
    sessionId: selected,
    subagentId,
    hasChannel: update.live,
    ready: true,
  }))
  return update.replayExpired ? update.cursor : cursor
}

export function applyLiveUpdate(target: LiveUpdateTarget & { update: SessionLiveUpdate }): number {
  const { selected, subagentId, update, cursor, setState } = target
  switch (update.type) {
    case 'ready':
      return applyReady(target, update)
    case 'event':
      if (update.event.sequence <= cursor) return cursor
      if (
        new TextEncoder().encode(JSON.stringify(update.event)).byteLength >
        SESSION_LIVE_REPLAY_BYTE_LIMIT
      )
        void queryClient.invalidateQueries({ queryKey: sessionFeedQueryKey(selected, subagentId) })
      setState((current) => ({
        ...retainLiveEvent(
          current?.sessionId === selected && current.subagentId === subagentId ? current : null,
          update.event,
        ),
        sessionId: selected,
        subagentId,
        hasChannel:
          current?.sessionId === selected && current.subagentId === subagentId
            ? current.hasChannel
            : true,
        ready: true,
      }))
      if (update.event.type === 'status' && update.event.status === 'idle')
        void queryClient.invalidateQueries({ queryKey: sessionFeedQueryKey(selected, subagentId) })
      if (subagentId === null && update.event.type === 'permission')
        void queryClient.invalidateQueries({ queryKey: sessionPermissionQueryKey(selected) })
      return update.event.sequence
    case 'expired':
      return update.cursor
    case 'invalidated':
      void queryClient.invalidateQueries({ queryKey: sessionFeedQueryKey(selected, subagentId) })
      return cursor
  }
}

function useFocusRefresh(sessionId: SessionId | null, subagentId: string | null) {
  useEffect(() => {
    if (sessionId === null) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const refresh = () => {
      if (timer !== null) clearTimeout(timer)
      timer = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: sessionFeedQueryKey(sessionId, subagentId) })
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
  }, [sessionId, subagentId])
}

export function useLiveFeedEvents(
  sessionId: SessionId | null,
  subagentId: string | null = null,
): LiveFeedState | null {
  const [state, setState] = useState<LiveFeedState | null>(null)
  useFocusRefresh(sessionId, subagentId)
  useEffect(() => {
    if (sessionId === null) return
    const selected = sessionId
    let stopped = false
    let cursor = 0
    let generation: string | null = null
    let connections = 0
    let reconnect: ReturnType<typeof setTimeout> | null = null
    let subscription: { unsubscribe: () => void } | null = null
    const connect = () => {
      const reconnected = connections > 0
      connections += 1
      subscription = trpcClient.sessionLiveEvents.subscribe(
        { sessionId: selected, subagentId, cursor, generation },
        {
          onData(update) {
            if (update.type === 'ready') generation = update.generation
            cursor = applyLiveUpdate({
              selected,
              subagentId,
              update,
              cursor,
              reconnected,
              setState,
            })
          },
          onError() {
            if (stopped) return
            setState((current) => ({
              ...(current?.sessionId === selected && current.subagentId === subagentId
                ? current
                : emptyLiveEventBuffer()),
              sessionId: selected,
              subagentId,
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
  }, [sessionId, subagentId])
  return state?.sessionId === sessionId && state.subagentId === subagentId ? state : null
}
