import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Progress } from '@/platform/renderer/components/ui/progress'
import { useObservedFeedReading } from '../feed/use-feed-reading'
import type { Session, SessionId } from '../types'
import {
  type SessionListStatus,
  useSessionListStatus,
  useSetSessionListStatus,
} from './hooks/use-session-list-filter-store'
import { useSettledSearch } from './hooks/use-settled-search'
import { RenameDialog } from './rename/rename-dialog'
import { useRenameDialog } from './rename/use-rename-dialog'
import type { SessionListActions } from './rows/session-list-actions'
import { SessionListOutcome, type SessionListState } from './rows/session-list-outcome'
import { SessionListVirtualList } from './rows/session-list-virtual-list'
import { useSessionListQuery } from './session-list-query'
import { sessionSyncProgress } from './session-sync-progress'
import { SessionsSidebarHeader } from './sidebar/sessions-sidebar-chrome'
import { useSidebarSessionList } from './sidebar/use-sidebar-session-list'
import { useSessionSync } from './use-session-sync'

export type { SessionListActions } from './rows'

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

// The header's controls, and the History sync the Refresh control starts.
function SessionListHeader({
  onNew,
  search,
  setSearch,
  status,
}: {
  onNew: () => void
  search: string
  setSearch: (search: string) => void
  status: SessionListStatus
}) {
  const setStatus = useSetSessionListStatus()
  const sync = useSessionSync()
  return (
    <>
      <SessionsSidebarHeader
        onNew={onNew}
        onRefresh={sync.refresh}
        onSearch={setSearch}
        onStatusChange={setStatus}
        refreshing={sync.refreshing}
        search={search}
        status={status}
      />
      <SessionSyncFeedback status={sync.status} />
    </>
  )
}

function SessionSyncFeedback({ status }: { status: ReturnType<typeof useSessionSync>['status'] }) {
  const { t } = useTranslation('sessions')
  if (status === null || (status.phase !== 'fetching' && status.phase !== 'saving')) return null
  const message =
    status.phase === 'fetching' || status.total === null
      ? t('sync.fetching')
      : t('sync.saving', { processed: status.processed, total: status.total })
  return (
    <div
      className="border-b border-border/60 px-4 py-2 type-meta text-muted-foreground"
      role="status"
    >
      <div className="flex items-center gap-2">
        <Progress
          aria-label={t('sync.progress')}
          className="min-w-0 flex-1"
          value={sessionSyncProgress(status)}
        />
        <span>{message}</span>
      </div>
    </div>
  )
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
  const list = useSidebarSessionList({ actions, sessions, selectedSessionId, sidebar })
  const { renameTarget, setRenameTarget, handleRename } = useRenameDialog(actions.onRename)
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
      <SessionListOutcome searching={settledSearch.trim() !== ''} state={state} />
      <SessionListVirtualList
        fetchNextPage={query.fetchNextPage}
        hasNextPage={query.hasNextPage}
        isFetchingNextPage={query.isFetchingNextPage}
        label="Sessions"
        unavailableSessionIds={useUnavailableSessionIds(selectedSessionId)}
        onArchive={list.archive}
        onFocus={list.focus.setFocusedSessionId}
        onOpenTicket={actions.onOpenTicket}
        onRename={setRenameTarget}
        onSelect={list.select}
        onToggleSelect={list.selection.toggle}
        selectedIds={list.selection.selectedIds}
        selectedSessionId={selectedSessionId}
        sessions={sessions}
        tabStop={list.focus.tabStop}
      />
      <RenameDialog onRename={handleRename} session={renameTarget} setSession={setRenameTarget} />
    </aside>
  )
}
