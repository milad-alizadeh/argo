import { useVirtualizer } from '@tanstack/react-virtual'
import type { TFunction } from 'i18next'
import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router'
import { useProjects } from '@/domains/projects/renderer'
import { matchesShortcut, pressedKeys, SESSION_LIST_MOVES } from '@/platform/contract/commands'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { SidebarSearch } from '@/platform/renderer/components/sidebar-search'
import { Alert, AlertDescription, AlertTitle } from '@/platform/renderer/components/ui/alert'
import { Button } from '@/platform/renderer/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/platform/renderer/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from '@/platform/renderer/components/ui/dropdown-menu'
import { MenuDropdownTrigger } from '@/platform/renderer/components/ui/dropdown-trigger'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/platform/renderer/components/ui/empty'
import { Progress } from '@/platform/renderer/components/ui/progress'
import { Skeleton } from '@/platform/renderer/components/ui/skeleton'
import { useToastManager } from '@/platform/renderer/components/ui/toast'
import { trpcClient } from '@/platform/renderer/trpc-client'
import { COMPOSER_FOCUS_STATE } from '../composer-focus-state'
import { useObservedFeedReading } from '../feed'
import type { Session, SessionId } from '../types'
import { useSessionListFocus, useSessionListSelection } from './hooks/use-session-list-selection'
import {
  FILTER_LABELS,
  type SessionListFilter,
  useSessionListFilter,
  useSessionListQuery,
  useSettledSearch,
} from './session-list-query'
import { SessionRenameDialog } from './session-rename-dialog'
import { SESSION_LIST_ROW_HEIGHT, SessionRow } from './session-row'
import { type SessionSyncStatus, useSessionSync } from './use-session-sync'

const NO_SESSIONS: Session[] = []

// A short-lived Undo: a manual dismiss and the timeout both leave the archive standing.
const UNDO_TOAST_TIMEOUT_MS = 8000

// Overscan generous enough to keep a realistic Project's rows mounted, so the arrow keys, which walk
// the mounted buttons, reach every row; windowing still applies to a longer list.
const OVERSCAN = 30

const FILTERS = Object.keys(FILTER_LABELS) as SessionListFilter[]

// One element, because base-ui reads `render` as a prop: a fresh one each render is a changed prop.
const MENU_TRIGGER = <div />

type SessionListState = 'error' | 'loading' | 'empty' | 'ready'

type Toasts = { add: ReturnType<typeof useToastManager>['add']; t: TFunction<'sessions'> }

// What the list's one context menu does to the row under the pointer.
type SessionMenuHandlers = {
  onArchive: (sessionId: SessionId) => void
  onOpenTicket: (session: Session) => void
  onRename: (session: Session) => void
}

// The visible range, not the overscanned items, says whether the reader reached the end (#2277).
type SessionPages = {
  fetchNextPage: () => unknown
  hasNextPage: boolean
  isFetchingNextPage: boolean
}

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

// One clock for every row's age, so the list re-renders once a minute rather than each row.
function useMinuteClock() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

function useNextPageAtTheEnd(lastVisibleIndex: number, count: number, pages: SessionPages) {
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = pages
  useEffect(() => {
    if (count === 0 || lastVisibleIndex < count - 1) return
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
  }, [count, fetchNextPage, hasNextPage, isFetchingNextPage, lastVisibleIndex])
}

type SessionListMove = keyof typeof SESSION_LIST_MOVES
const MOVES = Object.entries(SESSION_LIST_MOVES) as [SessionListMove, string][]

function moveFocus(event: KeyboardEvent<HTMLUListElement>) {
  const pressed = pressedKeys(event)
  const move = MOVES.find(([, command]) => matchesShortcut(command, pressed))?.[0]
  if (move === undefined) return
  const buttons = [
    ...event.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-session-id]'),
  ]
  const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
  if (current === -1) return
  event.preventDefault()
  const nextByMove = {
    next: Math.min(current + 1, buttons.length - 1),
    previous: Math.max(current - 1, 0),
    first: 0,
    last: buttons.length - 1,
  } satisfies Record<SessionListMove, number>
  buttons[nextByMove[move]]?.focus()
}

function menuTargetOf(element: EventTarget | null, sessions: readonly Session[]) {
  const row = element instanceof Element ? element.closest('[data-session-id]') : null
  const sessionId = row?.getAttribute('data-session-id') ?? null
  return sessions.find((session) => session.id === sessionId) ?? null
}

function SessionSyncFeedback({ status }: { status: SessionSyncStatus | null }) {
  const { t } = useTranslation('sessions')
  if (status === null || (status.phase !== 'fetching' && status.phase !== 'saving')) return null
  // Indeterminate until the worker knows how many Sessions it saves; none to save is complete.
  let progress: number | null = null
  if (status.phase === 'saving' && status.total !== null)
    progress = status.total === 0 ? 100 : (status.processed / status.total) * 100
  return (
    <div
      className="border-b border-border/60 px-4 py-2 type-meta text-muted-foreground"
      role="status"
    >
      <div className="flex items-center gap-2">
        <Progress aria-label={t('sync.progress')} className="min-w-0 flex-1" value={progress} />
        <span>
          {progress === null
            ? t('sync.fetching')
            : t('sync.saving', { processed: status.processed, total: status.total })}
        </span>
      </div>
    </div>
  )
}

function SessionListFilterMenu({
  filter,
  onFilterChange,
  sync,
}: {
  filter: SessionListFilter
  onFilterChange: (filter: SessionListFilter) => void
  sync: { refresh: () => void; refreshing: boolean }
}) {
  const { t } = useTranslation('sessions')
  return (
    <DropdownMenu>
      <MenuDropdownTrigger
        aria-label={t('filterSessions')}
        icon="session-list-filter"
        iconOnly
        label={t('filterSessions')}
        variant="ghost"
      />
      <DropdownMenuContent align="end" className="w-max">
        <DropdownMenuRadioGroup
          onValueChange={(value) => onFilterChange(value as SessionListFilter)}
          value={filter}
        >
          {FILTERS.map((value) => (
            <DropdownMenuRadioItem key={value} value={value}>
              {t(FILTER_LABELS[value])}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="whitespace-nowrap type-control"
          disabled={sync.refreshing}
          onClick={sync.refresh}
        >
          <Icon name="retry" />
          {t('refreshSessions')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// The search, the filter with its Refresh, New Session, and the History sync Refresh starts.
function SessionListHeader({
  filter,
  onFilterChange,
  onNew,
  search,
  setSearch,
}: {
  filter: SessionListFilter
  onFilterChange: (filter: SessionListFilter) => void
  onNew: () => void
  search: string
  setSearch: (search: string) => void
}) {
  const { t } = useTranslation('sessions')
  const sync = useSessionSync()
  return (
    <>
      <header className="flex h-(--size-chrome-bar) sidebar-gutter shrink-0 items-center">
        <SidebarSearch
          label={t('searchSessions')}
          onChange={setSearch}
          placeholder={`${t('searchSessions')}…`}
          value={search}
        />
        {/* The filter sits left of the plus, so the plus keeps the right edge every row lines up on. */}
        <div className="ml-(--spacing-shell-tight) flex items-center">
          <SessionListFilterMenu filter={filter} onFilterChange={onFilterChange} sync={sync} />
          <Button
            aria-label={t('newSession')}
            className="-mr-1.5"
            onClick={onNew}
            size="icon-sm"
            variant="ghost"
          >
            <Icon name="add" />
          </Button>
        </div>
      </header>
      <SessionSyncFeedback status={sync.status} />
    </>
  )
}

// Three skeleton rows in the Session row's shape and height, so nothing reflows when rows arrive.
function SessionListLoading() {
  const { t } = useTranslation('sessions')
  return (
    <div aria-label={t('readingSessions')} role="status">
      {[0, 1, 2].map((index) => (
        <div
          className="flex items-start gap-2 px-2 py-2"
          key={index}
          style={{ height: SESSION_LIST_ROW_HEIGHT }}
        >
          <Skeleton className="mt-0.5 size-4 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="mt-1.5 h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

// What the list says instead of rows: the read failed, the first read has not landed, or no rows.
function SessionListOutcome({ state }: { state: SessionListState }) {
  const { t } = useTranslation('sessions')
  switch (state) {
    case 'error':
      return (
        <Alert
          className="mx-3 mt-3 w-auto border-destructive/50 bg-destructive/10"
          variant="destructive"
        >
          <Icon name="triangle-alert" />
          <AlertTitle>{t('unableToLoadSessions')}</AlertTitle>
          <AlertDescription>{t('sessionListReadFailure')}</AlertDescription>
        </Alert>
      )
    case 'loading':
      return <SessionListLoading />
    case 'empty':
      return (
        <Empty className="flex-none px-4 py-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Icon name="no-sessions" />
            </EmptyMedia>
            <EmptyTitle>{t('noSessionsFound')}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      )
    case 'ready':
      return null
  }
}

function SessionMenuItems({
  onArchive,
  onOpenTicket,
  onRename,
  target,
}: SessionMenuHandlers & { target: Session }) {
  const { t } = useTranslation('sessions')
  return (
    <ContextMenuContent aria-label={t('contextMenu.actions', { title: target.name })}>
      <ContextMenuGroup>
        <ContextMenuItem onClick={() => onRename(target)}>
          {t('contextMenu.rename')}
        </ContextMenuItem>
        {target.ticket !== null ? (
          <ContextMenuItem onClick={() => onOpenTicket(target)}>
            {t('contextMenu.openTicket')}
          </ContextMenuItem>
        ) : null}
        {target.archived ? null : (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => onArchive(target.id)}>
              <Icon name="archive-session" />
              {t('bulkSelect.archive')}
            </ContextMenuItem>
          </>
        )}
      </ContextMenuGroup>
    </ContextMenuContent>
  )
}

// One menu for the whole list, opened on the row under the pointer: a menu per row mounted 46034
// ContextMenuTriggers in a 4.25s fling, 17.1s of render time, for menus nobody opened.
function SessionContextMenu({
  children,
  handlers,
  sessions,
}: {
  children: ReactNode
  handlers: SessionMenuHandlers
  sessions: readonly Session[]
}) {
  const [target, setTarget] = useState<Session | null>(null)
  const [open, setOpen] = useState(false)
  // The trigger opens in the event that names the row, before the state lands, so it reads a ref.
  const pointed = useRef<Session | null>(null)
  const readTarget = (event: MouseEvent) => {
    pointed.current = menuTargetOf(event.target, sessions)
    setTarget(pointed.current)
  }
  return (
    <ContextMenu onOpenChange={(next) => setOpen(next && pointed.current !== null)} open={open}>
      <ContextMenuTrigger onContextMenuCapture={readTarget} render={MENU_TRIGGER}>
        {children}
      </ContextMenuTrigger>
      {target === null ? null : <SessionMenuItems {...handlers} target={target} />}
    </ContextMenu>
  )
}

// The bottom of the list while the next page arrives: one row tall, the spinner centred in it.
function LoadingMoreRow() {
  const { t } = useTranslation('sessions')
  return (
    <div
      aria-label={t('loadingMoreSessions')}
      className="flex items-center justify-center"
      role="status"
      style={{ height: SESSION_LIST_ROW_HEIGHT }}
    >
      <Icon name="loading" className="size-4 animate-spin text-muted-foreground" />
    </div>
  )
}

type SessionRowsProps = {
  menu: SessionMenuHandlers
  onFocus: (sessionId: SessionId) => void
  onSelect: (sessionId: SessionId) => void
  onToggleSelect: Parameters<typeof SessionRow>[0]['onToggleSelect']
  pages: SessionPages
  selectedIds: ReadonlySet<SessionId>
  selectedSessionId: SessionId | null
  sessions: readonly Session[]
  tabStop: SessionId | null
  unavailableSessionIds: ReadonlySet<SessionId>
}

// The mounted window of rows, and the spinner row while the next page arrives.
function SessionRows(props: SessionRowsProps) {
  const { t } = useTranslation('sessions')
  const { pages, selectedIds, selectedSessionId, sessions, tabStop, unavailableSessionIds } = props
  const now = useMinuteClock()
  const scrollRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: sessions.length,
    getScrollElement: () => scrollRef.current,
    getItemKey: (index) => sessions[index]?.id ?? index,
    estimateSize: () => SESSION_LIST_ROW_HEIGHT,
    overscan: OVERSCAN,
  })
  useNextPageAtTheEnd(virtualizer.range?.endIndex ?? -1, sessions.length, pages)
  const rowOf = (session: Session) => (
    <SessionRow
      checked={selectedIds.has(session.id)}
      now={now}
      onFocus={props.onFocus}
      onSelect={props.onSelect}
      onToggleSelect={props.onToggleSelect}
      selected={session.id === selectedSessionId}
      session={session}
      tabbable={session.id === tabStop}
      unavailable={unavailableSessionIds.has(session.id)}
    />
  )
  return (
    <div
      className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto py-3"
      data-slot="session-list-scroll"
      ref={scrollRef}
    >
      <SessionContextMenu handlers={props.menu} sessions={sessions}>
        <nav aria-label={t('navigationLabel')} className="min-w-0">
          <ul
            className="relative flex min-w-0 flex-col px-3"
            onKeyDown={moveFocus}
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualizer.getVirtualItems().map((item) => {
              const session = sessions[item.index]
              return (
                <li
                  className="absolute inset-x-3 top-0 pb-1"
                  data-index={item.index}
                  key={item.key}
                  ref={virtualizer.measureElement}
                  style={{ transform: `translateY(${item.start}px)` }}
                >
                  {session === undefined ? null : rowOf(session)}
                </li>
              )
            })}
          </ul>
          {pages.isFetchingNextPage ? <LoadingMoreRow /> : null}
        </nav>
      </SessionContextMenu>
    </div>
  )
}

// The Project's Sessions in the sidebar. The route names the open one, even when no loaded row does.
export function SessionList() {
  const { t } = useTranslation('sessions')
  const { add } = useToastManager()
  const selectedSessionId = useParams().sessionId ?? null
  const [cockpit] = useProjects()
  const projectId = cockpit.project?.id ?? null
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
