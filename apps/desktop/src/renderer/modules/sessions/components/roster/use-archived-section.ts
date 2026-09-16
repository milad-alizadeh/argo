import { useEffect, useMemo, useRef } from 'react'
import { useArchivedSessions } from '../../hooks/use-archived-sessions'
import {
  showsArchived,
  useRosterFilterStore,
  useRosterStatus,
} from '../../state/use-roster-filter-store'
import type { SessionId } from '../../types'

// Ids the archive query has already surfaced, so a click on a row already on screen never counts
// as a restore: a restore changes the query's cache key (below), and treating every already-loaded
// row as one would drop the pages already fetched under the old key.
export function useArchivedSection(
  selectedSessionId: SessionId | null,
  visibleSessionIds: readonly SessionId[],
  rosterResolved: boolean,
) {
  const status = useRosterStatus()
  const setStatus = useRosterFilterStore((state) => state.setStatus)
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
  const enabled = showsArchived(status) || restoreId !== null
  const { error, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, restored, sessions } =
    useArchivedSessions(enabled, restoreId)

  useEffect(() => {
    for (const session of sessions) loadedIds.current.add(session.id)
    if (restored !== null) loadedIds.current.add(restored.id)
  })

  // A selected Session that turns out to be archived widens the filter rather than appearing under a
  // filter that excludes it, so what the reader sees and what the header says stay the same claim.
  useEffect(() => {
    if (restored !== null) setStatus('all')
  }, [restored, setStatus])

  // `restored` can fall outside every page already loaded, so it is shown by adding it to the
  // list rather than assuming a later page will bring it into view.
  const displayed = useMemo(
    () =>
      restored === null || sessions.some((session) => session.id === restored.id)
        ? sessions
        : [restored, ...sessions],
    [restored, sessions],
  )

  // One stable object, because the caller builds the row list from it: a fresh object here rebuilds
  // every row on each render and the memoized rows lose their memo.
  return useMemo(
    () => ({ displayed, error, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading }),
    [displayed, error, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading],
  )
}
