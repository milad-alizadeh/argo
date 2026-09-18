import { type RefObject, useCallback, useMemo, useState } from 'react'
import { useRosterFilterStore, useRosterStatus } from '../../state/use-roster-filter-store'
import type { SessionError, SessionId, SessionRoster, SessionsListed } from '../../types'
import { rosterState } from './sessions-sidebar-chrome'
import { useRosterFocus } from './use-roster-focus'
import { useRosterSelection } from './use-roster-selection'

const NO_SESSIONS: SessionsListed['sessions'] = []
const NO_TITLES: Record<string, string> = {}

// A renamed title is shown locally, keyed by session id, until a roster read carries the same
// title back through the transcript. Keying on the roster array's identity instead let a read
// that changed nothing else revert the row, because the remembered order builds a new array on every
// read whether or not any Session actually changed (#2290).
function pendingRenames(renamed: Record<string, string>, sessions: SessionsListed['sessions']) {
  const pending: Record<string, string> = {}
  for (const [sessionId, title] of Object.entries(renamed)) {
    const landed = sessions.find((session) => session.id === sessionId)
    if (landed === undefined || landed.title?.text !== title) pending[sessionId] = title
  }
  // The empty case keeps one identity, because a roster read rebuilds this and every row compares
  // it (#2386). Nothing is renamed most of the time.
  return Object.keys(pending).length === 0 ? NO_TITLES : pending
}

function filteredSessions(sessions: SessionsListed['sessions'], search: string) {
  const query = search.trim().toLocaleLowerCase()
  if (query === '') return sessions
  return sessions.filter((session) =>
    (session.title?.text ?? session.id).toLocaleLowerCase().includes(query),
  )
}

// Everything the sidebar reads off one roster: what the search and the status filter leave visible,
// which rows are selected, where the keyboard is, and the titles a rename is still waiting on.
export function useSidebarRoster({
  onArchiveSelected,
  onSelect,
  roster,
  rosterError,
  selectedSessionId,
  sidebar,
}: {
  onArchiveSelected: (sessionIds: SessionId[]) => void
  onSelect: (sessionId: SessionId) => void
  roster: SessionRoster | null
  rosterError: SessionError | null
  selectedSessionId: SessionId | null
  sidebar: RefObject<HTMLElement | null>
}) {
  const [renamed, setRenamed] = useState<Record<string, string>>(NO_TITLES)
  const [search, setSearch] = useState('')
  const status = useRosterStatus()
  const setStatus = useRosterFilterStore((state) => state.setStatus)
  const sessions = roster?.sessions ?? NO_SESSIONS
  // Memoized like every other value a row reads: a non-empty search built a new array on each render,
  // which rebuilt the row list and re-rendered every memoized row while the reader was typing.
  const visible = useMemo(() => filteredSessions(sessions, search), [sessions, search])
  const visibleIds = useMemo(() => visible.map((session) => session.id), [visible])
  const selection = useRosterSelection(visibleIds, selectedSessionId)
  const focus = useRosterFocus(sidebar, visible, selectedSessionId)

  // Both keep one identity for as long as their inputs do: a row is memoized, so a handler rebuilt
  // on every render would re-render every row whenever anything else on the screen ticked.
  const archive = useCallback(
    (sessionId: SessionId) => {
      const bulk = selection.selectedIds.has(sessionId)
      onArchiveSelected(bulk ? [...selection.selectedIds] : [sessionId])
      if (bulk) selection.clear()
    },
    [onArchiveSelected, selection],
  )
  const select = useCallback(
    (sessionId: SessionId) => {
      selection.clear()
      onSelect(sessionId)
    },
    [onSelect, selection],
  )

  return {
    archive,
    focus,
    renamedTitles: useMemo(() => pendingRenames(renamed, sessions), [renamed, sessions]),
    rename: (sessionId: SessionId, title: string) =>
      setRenamed((current) => ({ ...current, [sessionId]: title })),
    search,
    select,
    selection,
    sessionCount: sessions.length,
    setSearch,
    setStatus,
    state: rosterState(roster, rosterError, sessions.length),
    status,
    visible,
  }
}
