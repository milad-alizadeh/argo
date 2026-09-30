import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useObservedFeedReading } from '../feed/use-feed-reading'
import type { Session, SessionId } from '../types'
import { useSessionListStatus } from './hooks/use-session-list-filter-params'
import { useSessionListFocus } from './hooks/use-session-list-focus'
import { useSessionListSelection } from './hooks/use-session-list-selection'
import { useSettledSearch } from './hooks/use-settled-search'
import { SessionRenameDialog } from './rename/session-rename-dialog'
import type { SessionListActions } from './rows/session-list-actions'
import { SessionListOutcome, type SessionListState } from './rows/session-list-outcome'
import { SessionListVirtualList } from './rows/session-list-virtual-list'
import { SessionListHeader } from './session-list-header'
import { useSessionListQuery } from './session-list-query'

const NO_SESSIONS: Session[] = []

function useUnavailableSessionIds(selectedSessionId: SessionId | null) {
  const reading = useObservedFeedReading(selectedSessionId)
  const [unavailableSessionIds, setUnavailableSessionIds] = useState<ReadonlySet<SessionId>>(
    () => new Set(),
  )
  const state = reading?.state ?? null
  const code = reading?.error?.code ?? null
  useEffect(() => {
    if (selectedSessionId === null) return
    const unavailable = state === 'failed' && code === 'missing-session'
    if (!unavailable && state !== 'ready') return
    setUnavailableSessionIds((current) => {
      if (unavailable === current.has(selectedSessionId)) return current
      const next = new Set(current)
      if (unavailable) next.add(selectedSessionId)
      else next.delete(selectedSessionId)
      return next
    })
  }, [code, selectedSessionId, state])
  return unavailableSessionIds
}

function sessionListState(
  query: { isError: boolean; data: unknown },
  count: number,
): SessionListState {
  if (query.isError) return 'error'
  if (query.data === undefined) return 'loading'
  return count === 0 ? 'empty' : 'ready'
}

// The sidebar header, outcome and rows, under one named record of row actions (#2284).
type SessionListProps = {
  actions: SessionListActions
  projectId: string | null
  selectedSessionId: SessionId | null
}

export function SessionList({ actions, projectId, selectedSessionId }: SessionListProps) {
  const { t } = useTranslation('sessions')
  const sidebar = useRef<HTMLElement>(null)
  const [search, setSearch] = useState('')
  // The rows and the search state follow the text the list was last read with.
  const settledSearch = useSettledSearch(search)
  const status = useSessionListStatus()
  const query = useSessionListQuery(
    { projectId: projectId ?? '', filter: status, search: settledSearch },
    projectId !== null,
  )
  const pages = query.isError ? undefined : query.data?.pages
  const sessions = useMemo(() => pages?.flatMap((page) => page.rows) ?? NO_SESSIONS, [pages])
  const selection = useSessionListSelection(sessions, selectedSessionId, actions)
  const focus = useSessionListFocus(sidebar, sessions, selectedSessionId)
  const [renameTarget, setRenameTarget] = useState<Session | null>(null)
  const state = sessionListState(query, sessions.length)
  return (
    <aside
      aria-label={t('sidebarLabel')}
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-sidebar"
      data-page-count={query.data?.pages.length ?? 0}
      data-state={state}
      data-total={pages?.[0]?.total}
      ref={sidebar}
    >
      <SessionListHeader
        onNew={actions.onNew}
        search={search}
        setSearch={setSearch}
        status={status}
      />
      <SessionListOutcome state={state} />
      <SessionListVirtualList
        fetchNextPage={query.fetchNextPage}
        hasNextPage={query.hasNextPage}
        isFetchingNextPage={query.isFetchingNextPage}
        unavailableSessionIds={useUnavailableSessionIds(selectedSessionId)}
        onArchive={selection.archive}
        onFocus={focus.setFocusedSessionId}
        onOpenTicket={actions.onOpenTicket}
        onRename={setRenameTarget}
        onSelect={selection.select}
        onToggleSelect={selection.toggle}
        selectedIds={selection.selectedIds}
        selectedSessionId={selectedSessionId}
        sessions={sessions}
        tabStop={focus.tabStop}
      />
      <SessionRenameDialog
        onClose={() => setRenameTarget(null)}
        onRename={actions.onRename}
        session={renameTarget}
      />
    </aside>
  )
}
