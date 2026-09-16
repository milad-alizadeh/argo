import { useEffect, useRef, useState } from 'react'
import { useArchivedSessions } from '../../hooks/use-archived-sessions'
import type { SessionId } from '../../types'

// Ids the archive query has already surfaced, so a click on a row already on screen never counts
// as a restore: a restore changes the query's cache key (below), and treating every already-loaded
// row as one would drop the pages already fetched under the old key.
export function useArchivedSection(
  selectedSessionId: SessionId | null,
  visibleSessionIds: readonly SessionId[],
  rosterResolved: boolean,
) {
  const [open, setOpen] = useState(false)
  const loadedIds = useRef<Set<SessionId>>(new Set())
  // A selection that is not among the active rows AND not already loaded here can only be an
  // archived Session restored from a route or a persisted choice: ask the reader for it by id
  // even before the section is opened by hand, so the sidebar can show it selected rather than
  // showing nothing selected. Gated on the roster having resolved at least once (#2239): while it
  // is still unresolved, every visible id is empty and would misread as a restore.
  const restoreId =
    rosterResolved &&
    selectedSessionId !== null &&
    !visibleSessionIds.includes(selectedSessionId) &&
    !loadedIds.current.has(selectedSessionId)
      ? selectedSessionId
      : null
  const enabled = open || restoreId !== null
  const { error, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, restored, sessions } =
    useArchivedSessions(enabled, restoreId)

  useEffect(() => {
    for (const session of sessions) loadedIds.current.add(session.id)
    if (restored !== null) loadedIds.current.add(restored.id)
  })

  useEffect(() => {
    if (restored !== null) setOpen(true)
  }, [restored])

  // `restored` can fall outside every page already loaded, so it is shown by adding it to the
  // list rather than assuming a later page will bring it into view.
  const displayed =
    restored === null || sessions.some((session) => session.id === restored.id)
      ? sessions
      : [restored, ...sessions]

  return {
    displayed,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    open,
    setOpen,
  }
}
