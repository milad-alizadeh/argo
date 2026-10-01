import type { TFunction } from 'i18next'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router'
import { useProjects } from '@/domains/projects/renderer'
import { useToastManager } from '@/platform/renderer/components/ui/toast'
import { trpcClient } from '@/platform/renderer/trpc-client'
import { COMPOSER_FOCUS_STATE } from '../composer-focus-state'
import { useObservedFeedReading } from '../feed'
import type { Session, SessionId } from '../types'
import { useSessionListFocus, useSessionListSelection } from './hooks/use-session-list-selection'
import { SessionListHeader } from './session-list-header'
import { SessionListOutcome, type SessionListState } from './session-list-outcome'
import { useSessionListFilter, useSessionListQuery, useSettledSearch } from './session-list-query'
import { SessionRows } from './session-list-rows'
import { SessionRenameDialog } from './session-rename-dialog'

const NO_SESSIONS: Session[] = []

// A short-lived Undo: a manual dismiss and the timeout both leave the archive standing.
const UNDO_TOAST_TIMEOUT_MS = 8000

type Toasts = { add: ReturnType<typeof useToastManager>['add']; t: TFunction<'sessions'> }

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

// The ids main updated (#2194), or null when the update failed and its reason was shown.
async function updateArchived(toasts: Toasts, sessionIds: SessionId[], archived: boolean) {
  try {
    return (await trpcClient.sessionUpdate.mutate({ sessionIds, archived })).sessionIds
  } catch (error) {
    toasts.add({
      title: toasts.t('bulkSelect.failure'),
      description: error instanceof Error ? error.message : undefined,
      type: 'error',
      timeout: UNDO_TOAST_TIMEOUT_MS,
    })
    return null
  }
}

async function restoreSessions(toasts: Toasts, sessionIds: SessionId[]) {
  const restored = await updateArchived(toasts, sessionIds, false)
  if (restored === null || restored.length === 0) return
  toasts.add({
    title: toasts.t('bulkSelect.restored', { count: restored.length }),
    type: 'success',
    timeout: UNDO_TOAST_TIMEOUT_MS,
  })
}

async function archiveSessions(toasts: Toasts, sessionIds: SessionId[]) {
  const applied = await updateArchived(toasts, sessionIds, true)
  if (applied === null) return
  const { add, t } = toasts
  if (applied.length > 0)
    add({
      title: t('bulkSelect.archived', { count: applied.length }),
      type: 'success',
      timeout: UNDO_TOAST_TIMEOUT_MS,
      actionProps: {
        children: t('bulkSelect.undo'),
        onClick: () => void restoreSessions(toasts, applied),
      },
    })
  if (applied.length < sessionIds.length)
    add({
      title: applied.length > 0 ? t('bulkSelect.partialFailure') : t('bulkSelect.failure'),
      type: 'error',
      timeout: UNDO_TOAST_TIMEOUT_MS,
    })
}

// The rows the header's search and filter select for one Project.
function useListedSessions(projectId: string | null) {
  const [search, setSearch] = useState('')
  // The rows and the search state follow the text the list was last read with.
  const settledSearch = useSettledSearch(search)
  const [filter, setFilter] = useSessionListFilter()
  const query = useSessionListQuery(
    { projectId: projectId ?? '', filter, search: settledSearch },
    projectId !== null,
  )
  const pages = query.isError ? undefined : query.data?.pages
  const sessions = useMemo(() => pages?.flatMap((page) => page.rows) ?? NO_SESSIONS, [pages])
  return { filter, setFilter, search, setSearch, query, sessions }
}

function useSessionListNavigation(projectId: string | null) {
  const navigate = useNavigate()
  const { search } = useLocation()
  return {
    onNew: () => navigate(`/projects/${projectId}/sessions/new`, { state: COMPOSER_FOCUS_STATE }),
    onOpenTicket: (session: Session) => {
      if (session.ticket !== null) navigate(`/projects/${projectId}/tickets/${session.ticket.key}`)
    },
    // Stable, because it reaches every memoized row.
    onSelect: useCallback(
      (sessionId: SessionId) => navigate(`/projects/${projectId}/sessions/${sessionId}${search}`),
      [search, navigate, projectId],
    ),
  }
}

// The Project's Sessions in the sidebar. The route names the open one, even when no loaded row does.
export function SessionList() {
  const { t } = useTranslation('sessions')
  const { add } = useToastManager()
  const selectedSessionId = useParams().sessionId ?? null
  const [projectState] = useProjects()
  const projectId = projectState.project?.id ?? null
  const sidebar = useRef<HTMLElement>(null)
  const { filter, setFilter, search, setSearch, query, sessions } = useListedSessions(projectId)
  const { onNew, onOpenTicket, onSelect } = useSessionListNavigation(projectId)
  const selection = useSessionListSelection(sessions, selectedSessionId, {
    onArchiveSelected: (sessionIds) => void archiveSessions({ add, t }, sessionIds),
    onSelect,
  })
  const focus = useSessionListFocus(sidebar, sessions, selectedSessionId)
  const [renameTarget, setRenameTarget] = useState<Session | null>(null)
  const menu = { onArchive: selection.archive, onOpenTicket, onRename: setRenameTarget }
  const state = sessionListState(query, sessions.length)
  return (
    <aside
      aria-label={t('sidebarLabel')}
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-sidebar"
      data-page-count={query.data?.pages.length ?? 0}
      data-state={state}
      data-total={query.data?.pages[0]?.total}
      ref={sidebar}
    >
      <SessionListHeader
        filter={filter}
        onFilterChange={setFilter}
        onNew={onNew}
        search={search}
        setSearch={setSearch}
      />
      <SessionListOutcome state={state} />
      <SessionRows
        menu={menu}
        onFocus={focus.setFocusedSessionId}
        onSelect={selection.select}
        onToggleSelect={selection.toggle}
        pages={query}
        selectedIds={selection.selectedIds}
        selectedSessionId={selectedSessionId}
        sessions={sessions}
        tabStop={focus.tabStop}
        unavailableSessionIds={useUnavailableSessionIds(selectedSessionId)}
      />
      <SessionRenameDialog onClose={() => setRenameTarget(null)} session={renameTarget} />
    </aside>
  )
}
