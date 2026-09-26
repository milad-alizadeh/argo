import { type RefObject, useCallback, useMemo, useState } from 'react'
import type { Session, SessionError, SessionId, SessionListPage } from '../../types'
import {
  useSessionListStatus,
  useSetSessionListStatus,
} from '../hooks/use-session-list-filter-store'
import { useSessionListFocus } from '../hooks/use-session-list-focus'
import { useSessionListSelection } from '../hooks/use-session-list-selection'
import { sessionListState } from '../rows/session-list-status-row'

const NO_SESSIONS: Session[] = []
const NO_TITLES: Record<string, string> = {}

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

// Everything the sidebar reads off one Session list: what the search and status filter leave visible,
// which rows are selected, where the keyboard is, and the titles a rename is still waiting on. A
export function useSidebarSessionList({
  onArchiveSelected,
  onSelect,
  search,
  sessionList,
  sessionListError,
  selectedSessionId,
  sidebar,
}: {
  onArchiveSelected: (sessionIds: SessionId[]) => void
  onSelect: (sessionId: SessionId, retiredIds?: SessionId[]) => void
  search: string
  sessionList: SessionListPage | null
  sessionListError: SessionError | null
  selectedSessionId: SessionId | null
  sidebar: RefObject<HTMLElement | null>
}) {
  const [renamed, setRenamed] = useState<Record<string, string>>(NO_TITLES)
  const status = useSessionListStatus()
  const setStatus = useSetSessionListStatus()
  const sessions = sessionList?.sessions ?? NO_SESSIONS
  const searching = search.trim() !== ''
  const visible = sessions
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
    clearRename: (sessionId: SessionId) =>
      setRenamed((current) => {
        if (current[sessionId] === undefined) return current
        const next = { ...current }
        delete next[sessionId]
        return Object.keys(next).length === 0 ? NO_TITLES : next
      }),
    focus,
    renamedTitles: useMemo(() => pendingRenames(renamed, sessions), [renamed, sessions]),
    rename: (sessionId: SessionId, title: string) =>
      setRenamed((current) => ({ ...current, [sessionId]: title })),
    search,
    searching,
    select,
    selection,
    sessionCount: sessions.length,
    setStatus,
    state: sessionListState(sessionList, sessionListError, sessions.length),
    status,
    visible,
  }
}
