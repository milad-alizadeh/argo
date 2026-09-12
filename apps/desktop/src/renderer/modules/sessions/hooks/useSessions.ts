import { useCallback, useEffect, useRef, useState } from 'react'

import type { SessionFeed, SessionId, SessionsListed } from '../types'

let nextRequest = 0
const FEED_REFRESH_MS = 500
function requestId(name: string): string {
  nextRequest += 1
  return `${name}-${nextRequest}`
}

// The Roster is a reading of files Argo does not own and cannot be told about: nothing here
// watches the transcripts, so what a reader sees is what the last pass found. `reread` is the
// reader asking for another one, and it is the only thing that moves the Roster on.
function useRoster() {
  const [roster, setRoster] = useState<SessionsListed | null>(null)
  const [rosterError, setRosterError] = useState<string | null>(null)
  const [passes, setPasses] = useState(0)

  useEffect(() => {
    let live = true
    // A pass begins with no verdict on it. Leaving the last failure standing would report a fault
    // that this pass may be about to clear.
    setRosterError(null)
    void window.argo
      // The pass this request belongs to is part of its name, so a reply can be traced to the
      // asking rather than only to the surface that asked. What re-runs the effect is `passes` in
      // the dependency list, not this.
      .listSessions({ version: 1, type: 'session.list', requestId: requestId(`list-${passes}`) })
      .then((reply) => {
        if (!live) return
        if (reply.type === 'session.error') setRosterError(reply.message)
        else setRoster(reply)
      })
    return () => {
      live = false
    }
  }, [passes])

  const reread = useCallback(() => setPasses((pass) => pass + 1), [])
  return { roster, rosterError, reread }
}

// The reply carries the Session it was READ FOR, so a caller holding a newly chosen id and the
// previous Session's rows can tell that the two do not go together.
function useFeed(sessionId: SessionId | null) {
  const [feed, setFeed] = useState<SessionFeed | null>(null)
  const [feedError, setFeedError] = useState<string | null>(null)
  const revisions = useRef(new Map<SessionId, string>())

  useEffect(() => {
    if (sessionId === null) return
    let live = true
    let timer: number | null = null
    // The first read needs rows because its prior revision can outlive an evicted kept document.
    revisions.current.delete(sessionId)
    setFeed(null)
    setFeedError(null)
    const read = async () => {
      try {
        const reply = await window.argo.readSessionFeed({
          version: 1,
          type: 'session.feed',
          requestId: requestId('feed'),
          sessionId,
          revision: revisions.current.get(sessionId) ?? null,
        })
        if (!live) return
        if (reply.type === 'session.error') setFeedError(reply.message)
        else if (reply.type === 'session.feed.read') {
          revisions.current.set(reply.sessionId, reply.revision)
          setFeed(reply)
        }
      } finally {
        if (live) timer = window.setTimeout(() => void read(), FEED_REFRESH_MS)
      }
    }
    void read()
    return () => {
      live = false
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [sessionId])

  return { feed, feedError }
}

export function useSessions(selectedSessionId: SessionId | null) {
  const { roster, rosterError, reread } = useRoster()
  const { feed, feedError } = useFeed(selectedSessionId)
  // The Feed on hand is drawn only while it is the Feed for the chosen Session. Choosing another
  // renders the screen with the new id before the effect that clears the rows has run, so for one
  // committed frame the previous Session's history is in hand under the new Session's name.
  // Comparing the two is what stops that frame reaching the screen.
  const shown = feed !== null && feed.sessionId === selectedSessionId ? feed : null
  return { roster, rosterError, feed: shown, feedError, reread }
}
