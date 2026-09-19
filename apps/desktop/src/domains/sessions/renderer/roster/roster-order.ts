import { useEffect, useMemo } from 'react'
import {
  useRememberedRosterOrder,
  useRosterWindowStore,
} from '@/domains/sessions/renderer/roster/use-roster-window-store'
import type { SessionId, SessionRoster, SessionsListed } from '@/domains/sessions/renderer/types'
import { useSessions } from '@/domains/sessions/renderer/use-sessions'

type Sessions = SessionsListed['sessions']

// The reader's roster is ordered by the order each Session was first observed in, not by the order
// the current read returns. The reads come back most-recently-written first, so a Session that
// gains a message would otherwise climb the list under the reader's pointer (#2241).
//
// A Session the remembered order has never placed keeps the position the read gave it, between
// whichever remembered rows it arrived between. That distinguishes the two ways a row can be new:
// a Session created just now arrives above everything and belongs at the top, while the Sessions a
// wider window reveals are older than every row already loaded and belong at the bottom. Leading
// them all unconditionally sent a page of old Sessions to the top of the list.
export function rememberedRosterOrder(sessions: Sessions, remembered: readonly SessionId[]) {
  const rememberedIndex = new Map(remembered.map((id, index) => [id, index]))
  const indexOf = (session: Sessions[number]) => {
    const direct = rememberedIndex.get(session.id)
    if (direct !== undefined) return direct
    for (const retiredId of session.retiredIds) {
      const found = rememberedIndex.get(retiredId)
      if (found !== undefined) return found
    }
    return -1
  }

  const placed: { session: Sessions[number]; index: number }[] = []
  const unplacedAfter = new Map<number, Sessions[number][]>()
  let previousIndex = -1
  for (const session of sessions) {
    const index = indexOf(session)
    if (index === -1) {
      unplacedAfter.set(previousIndex, [...(unplacedAfter.get(previousIndex) ?? []), session])
      continue
    }
    placed.push({ session, index })
    previousIndex = index
  }
  placed.sort((left, right) => left.index - right.index)

  const ordered = [...(unplacedAfter.get(-1) ?? [])]
  for (const entry of placed) {
    ordered.push(entry.session)
    ordered.push(...(unplacedAfter.get(entry.index) ?? []))
  }
  return ordered
}

// The remembered order is per project scope, so switching project reads that project's roster in
// the order it returns rather than through the order the previous project left behind. It is held in
// the roster window store rather than in a ref here, because a ref is forgotten when the sidebar
// unmounts and the list then resorted itself back into read order under the reader.
export function useRosterOrder(roster: SessionRoster | null, scope: string | null) {
  const remembered = useRememberedRosterOrder(scope)
  const remember = useRosterWindowStore((state) => state.remember)
  const ordered = useMemo(() => {
    if (roster === null) return null
    return { ...roster, sessions: rememberedRosterOrder(roster.sessions, remembered) }
  }, [roster, remembered])

  // Recorded after the render that drew it, never during: the store ignores an unchanged order, so
  // this settles in one pass instead of feeding itself.
  useEffect(() => {
    if (ordered === null) return
    remember(
      scope,
      ordered.sessions.map((session) => session.id),
    )
  }, [ordered, remember, scope])

  return ordered
}

// The one read the sidebar's row list is built from, and the one the restore-on-mount effect
// consults to tell a stored id apart from an archived one: both share this query's cache, so
// calling it twice never doubles the read.
export function useOrderedSessions(projectRoot: string | null) {
  const read = useSessions(null, true, projectRoot)
  return { ...read, roster: useRosterOrder(read.roster, projectRoot) }
}
