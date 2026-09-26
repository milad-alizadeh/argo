import { type RefObject, useCallback, useMemo, useState } from 'react'
import type { Session, SessionError, SessionId, SessionListPage } from '../../types'
import {
  useSessionListStatus,
  useSetSessionListStatus,
} from '../hooks/use-session-list-filter-store'
import { useSessionListFocus } from '../hooks/use-session-list-focus'
import { useSessionListSelection } from '../hooks/use-session-list-selection'
import { sessionListState } from '../rows/session-list-status-row'
import { useSessionSearch } from './use-session-search'

const NO_SESSIONS: Session[] = []
const NO_TITLES: Record<string, string> = {}

export function sessionListTitledSearchResults(
  searched: readonly Session[],
  sessionList: readonly Session[],
): Session[] {
  const sessionListById = new Map(sessionList.map((session) => [session.id, session]))
  return searched.map((session) => sessionListById.get(session.id) ?? session)
}

// A renamed title is shown locally, keyed by session id, until a Session list read carries the same
// title back through the transcript. Keying on the Session list array's identity instead lets any
// equivalent read revert the row before the renamed title lands (#2290).
function pendingRenames(renamed: Record<string, string>, sessions: readonly Session[]) {
  const pending: Record<string, string> = {}
  for (const [sessionId, title] of Object.entries(renamed)) {
    const landed = sessions.find((session) => session.id === sessionId)
    if (landed === undefined || landed.title?.text !== title) pending[sessionId] = title
  }
  // The empty case keeps one identity, because a Session list read rebuilds this and every row compares
  // it (#2386). Nothing is renamed most of the time.
  return Object.keys(pending).length === 0 ? NO_TITLES : pending
}

// Everything the sidebar reads off one sessionList: what the search and the status filter leave visible,
// which rows are selected, where the keyboard is, and the titles a rename is still waiting on. A
// non-empty search reads across the complete indexed history through the shared reader (#2375)
// rather than filtering the rows the sessionList's own window has already loaded, so `visible` comes
// from the search hook instead of the loaded Session list while a query is live.
export function useSidebarSessionList({
  onArchiveSelected,
  onSelect,
  projectRoot,
  sessionList,
  sessionListError,
  selectedSessionId,
  sidebar,
}: {
  onArchiveSelected: (sessionIds: SessionId[]) => void
  onSelect: (sessionId: SessionId, retiredIds?: SessionId[]) => void
  projectRoot: string | null
  sessionList: SessionListPage | null
  sessionListError: SessionError | null
  selectedSessionId: SessionId | null
  sidebar: RefObject<HTMLElement | null>
}) {
  const [renamed, setRenamed] = useState<Record<string, string>>(NO_TITLES)
  const [search, setSearch] = useState('')
  const status = useSessionListStatus()
  const setStatus = useSetSessionListStatus()
  const sessions = sessionList?.sessions ?? NO_SESSIONS
  const searching = search.trim() !== ''
  const searched = useSessionSearch(search, projectRoot, status)
  const visible = useMemo(
    () => (searching ? sessionListTitledSearchResults(searched.sessions, sessions) : sessions),
    [searched.sessions, searching, sessions],
  )
  const visibleIds = useMemo(() => visible.map((session) => session.id), [visible])
  const selection = useSessionListSelection(visibleIds, selectedSessionId)
  const focus = useSessionListFocus(sidebar, visible, selectedSessionId)

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
    (sessionId: SessionId, retiredIds?: SessionId[]) => {
      const session = visible.find((candidate) => candidate.id === sessionId)
      if (session === undefined && retiredIds === undefined) return
      selection.clear()
      onSelect(sessionId, retiredIds ?? session?.retiredIds)
    },
    [onSelect, selection, visible],
  )

  return {
    archive,
    focus,
    renamedTitles: useMemo(() => pendingRenames(renamed, sessions), [renamed, sessions]),
    rename: (sessionId: SessionId, title: string) =>
      setRenamed((current) => ({ ...current, [sessionId]: title })),
    search,
    searched,
    searching,
    select,
    selection,
    sessionCount: sessions.length,
    setSearch,
    setStatus,
    state: sessionListState(sessionList, sessionListError, sessions.length),
    status,
    visible,
  }
}
