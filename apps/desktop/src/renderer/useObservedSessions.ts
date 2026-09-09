import { useEffect, useState } from 'react'
import type { SessionError } from '../sessions/contract'
import type { FeedRow } from '../sessions/feed'
import type { RosterRow } from '../sessions/roster'

let nextRequest = 0
function requestId(name: string): string {
  nextRequest += 1
  return `${name}-${nextRequest}`
}

// What one Roster pass reached. Named for the reading rather than for the act, because the main
// process has its own `Discovery` and two types under one word is one word too few.
export type RosterReading = {
  sessions: RosterRow[]
  filesFound: number
  filesRead: number
  filesUnreadable: number
}

// The Roster is a reading of files Argo does not own and cannot be told about: nothing here
// watches the transcripts, so what a reader sees is what the last pass found. `reread` is the
// reader asking for another one, and it is the only thing that moves the Roster on.
export function useRoster() {
  const [discovery, setDiscovery] = useState<RosterReading | null>(null)
  const [failure, setFailure] = useState<SessionError | null>(null)
  const [passes, setPasses] = useState(0)
  useEffect(() => {
    let live = true
    // A pass begins with no verdict on it. Leaving the last failure standing would report a fault
    // that this pass may be about to clear.
    setFailure(null)
    void window.argo
      // The pass this request belongs to is part of its name, so a reply can be traced to the
      // asking rather than only to the surface that asked. What re-runs the effect is `passes` in
      // the dependency list, not this.
      .listSessions({ version: 1, type: 'session.list', requestId: requestId(`list-${passes}`) })
      .then((reply) => {
        if (!live) return
        if (reply.type === 'session.error') setFailure(reply)
        else setDiscovery(reply)
      })
    return () => {
      live = false
    }
  }, [passes])
  return { discovery, failure, reread: () => setPasses((pass) => pass + 1) }
}

// The Session this Feed was READ FOR travels with it. Without it a caller holding a newly chosen
// id and the previous Session's rows cannot tell that the two do not go together.
export type ReadFeed = { sessionId: string; rows: FeedRow[] }

export function useFeed(sessionId: string | null) {
  const [feed, setFeed] = useState<ReadFeed | null>(null)
  const [failure, setFailure] = useState<SessionError | null>(null)

  useEffect(() => {
    if (sessionId === null) return
    let live = true
    setFeed(null)
    setFailure(null)
    void window.argo
      .readSessionFeed({
        version: 1,
        type: 'session.feed',
        requestId: requestId('feed'),
        sessionId,
      })
      .then((reply) => {
        if (!live) return
        if (reply.type === 'session.error') setFailure(reply)
        else setFeed({ sessionId, rows: reply.rows })
      })
    return () => {
      live = false
    }
  }, [sessionId])

  return { feed, failure }
}
