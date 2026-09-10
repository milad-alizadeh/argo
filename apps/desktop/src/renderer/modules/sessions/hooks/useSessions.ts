import { useCallback, useEffect, useState } from 'react'

import type { SessionFeed, SessionId, SessionsListed } from '../types'

type SessionsReading = {
  roster: SessionsListed | null
  rosterError: string | null
  feed: SessionFeed | null
  feedError: string | null
}

const initialReading: SessionsReading = {
  roster: null,
  rosterError: null,
  feed: null,
  feedError: null,
}

export function useSessions(selectedSessionId: SessionId | null) {
  const [reading, setReading] = useState<SessionsReading>(initialReading)

  const refreshRoster = useCallback(async () => {
    try {
      const reply = await window.argo.listSessions({
        version: 1,
        type: 'session.list',
        requestId: 'sessions-screen',
      })
      if (reply.type === 'session.error') {
        setReading((current) => ({ ...current, rosterError: reply.message }))
        return
      }
      setReading((current) => ({ ...current, roster: reply, rosterError: null }))
    } catch (error) {
      setReading((current) => ({
        ...current,
        rosterError: error instanceof Error ? error.message : 'Unable to list sessions.',
      }))
    }
  }, [])

  useEffect(() => {
    void refreshRoster()
  }, [refreshRoster])

  useEffect(() => {
    if (selectedSessionId === null) {
      setReading((current) => ({ ...current, feed: null, feedError: null }))
      return
    }

    let active = true
    void window.argo
      .readSessionFeed({
        version: 1,
        type: 'session.feed',
        requestId: 'sessions-feed',
        sessionId: selectedSessionId,
      })
      .then((reply) => {
        if (!active) return
        if (reply.type === 'session.error') {
          setReading((current) => ({ ...current, feedError: reply.message }))
          return
        }
        setReading((current) => ({ ...current, feed: reply, feedError: null }))
      })
      .catch((error: unknown) => {
        if (active)
          setReading((current) => ({
            ...current,
            feedError: error instanceof Error ? error.message : 'Unable to read this session.',
          }))
      })
    return () => {
      active = false
    }
  }, [selectedSessionId])

  return { ...reading, refreshRoster }
}
