import type { TFunction } from 'i18next'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router'
import { useProjects } from '@/domains/projects/renderer'
import type {
  RemovalOutcome,
  RemovedWorktree,
  WorktreeRemoval,
} from '@/domains/sessions/main/worktree'
import { useToastManager } from '@/platform/renderer/components/ui/toast'
import { type RouterInputs, trpcClient } from '@/platform/renderer/trpc-client'
import { COMPOSER_FOCUS_STATE } from '../composer-focus-state'
import { useObservedFeedReading } from '../feed'
import type { Session, SessionId } from '../types'
import { useSessionListFocus, useSessionListSelection } from './hooks/use-session-list-selection'
import {
  type ArchiveAnswer,
  type ArchiveQuestion,
  type HeldWorktree,
  SessionArchiveDialog,
} from './session-archive-dialog'
import { SessionListHeader } from './session-list-header'
import { SessionListOutcome, type SessionListState } from './session-list-outcome'
import { useSessionListFilter, useSessionListQuery, useSettledSearch } from './session-list-query'
import { SessionRows } from './session-list-rows'
import { SessionRenameDialog } from './session-rename-dialog'

const NO_SESSIONS: Session[] = []

// The Undo window: a dismiss or the timeout leaves the archive standing and lets its worktrees go.
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

// The ids main updated (#2194), or null when the update failed and said so.
async function updateArchived(toasts: Toasts, update: RouterInputs['sessionUpdate']) {
  try {
    return await trpcClient.sessionUpdate.mutate(update)
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
  const restored = (await updateArchived(toasts, { sessionIds, archived: false }))?.sessionIds
  if (restored === undefined || restored.length === 0) return
  toasts.add({
    title: toasts.t('bulkSelect.restored', { count: restored.length }),
    type: 'success',
    timeout: UNDO_TOAST_TIMEOUT_MS,
  })
}

// Main removes the archived Sessions' worktrees it may, then each one it left is told.
async function removeArchivedWorktrees(
  toasts: Toasts,
  sessionIds: SessionId[],
  removal: WorktreeRemoval,
) {
  try {
    const { worktrees } = await trpcClient.sessionWorktreeRemove.mutate({ sessionIds, removal })
    for (const worktree of worktrees) tellUnremoved(toasts, worktree)
  } catch (error) {
    toasts.add({
      title: toasts.t('archiveWorktree.removeFailed'),
      description: error instanceof Error ? error.message : undefined,
      type: 'error',
    })
  }
}

async function archiveSessions(toasts: Toasts, sessionIds: SessionId[], removal: WorktreeRemoval) {
  const updated = await updateArchived(toasts, { sessionIds, archived: true })
  if (updated === null) return
  const applied = updated.sessionIds
  const { add, t } = toasts
  let undone = false
  if (applied.length > 0)
    add({
      title: t('bulkSelect.archived', { count: applied.length }),
      type: 'success',
      timeout: UNDO_TOAST_TIMEOUT_MS,
      actionProps: {
        children: t('bulkSelect.undo'),
        onClick: () => {
          undone = true
          void restoreSessions(toasts, applied)
        },
      },
      // The Undo window is the toast's life; Undo within it keeps every worktree.
      onClose: () => {
        if (!undone) void removeArchivedWorktrees(toasts, applied, removal)
      },
    })
  if (applied.length < sessionIds.length)
    add({
      title: applied.length > 0 ? t('bulkSelect.partialFailure') : t('bulkSelect.failure'),
      type: 'error',
      timeout: UNDO_TOAST_TIMEOUT_MS,
    })
}

// Only a worktree the archive meant to remove, yet left, is worth a toast.
const UNREMOVED_TOAST = {
  removed: null,
  missing: null,
  kept: null,
  running: { title: 'archiveWorktree.running', type: 'info' },
  refused: { title: 'archiveWorktree.refused', type: 'error' },
} as const satisfies Record<RemovalOutcome, { title: string; type: 'info' | 'error' } | null>

function tellUnremoved(toasts: Toasts, worktree: RemovedWorktree) {
  const toast = UNREMOVED_TOAST[worktree.outcome]
  if (toast !== null)
    toasts.add({ title: toasts.t(toast.title, { path: worktree.path }), type: toast.type })
}

// When main cannot check, each listed Session's own worktree is named with its work unknown.
async function archiveQuestion(
  sessionIds: SessionId[],
  sessions: readonly Session[],
): Promise<ArchiveQuestion> {
  try {
    const { worktrees } = await trpcClient.sessionWorktreeWork.query({ sessionIds })
    return { sessionIds, worktrees, checked: true }
  } catch {
    const worktrees = sessions.flatMap(({ id, worktree }): HeldWorktree[] =>
      sessionIds.includes(id) && worktree !== null
        ? [
            {
              sessionId: id,
              path: worktree.path,
              branch: worktree.branch,
              changedFiles: null,
              ownCommits: null,
            },
          ]
        : [],
    )
    return { sessionIds, worktrees, checked: false }
  }
}

const REMOVAL_FOR_ANSWER = { keep: 'clean', remove: 'all' } as const satisfies Record<
  Exclude<ArchiveAnswer, 'cancel'>,
  WorktreeRemoval
>

// Removes clean Session worktrees once the Undo closes; asks about any holding work or unchecked.
function useSessionArchive(toasts: Toasts, sessions: readonly Session[]) {
  const [question, setQuestion] = useState<ArchiveQuestion | null>(null)
  const archive = async (sessionIds: SessionId[]) => {
    const asked = await archiveQuestion(sessionIds, sessions)
    if (asked.checked && asked.worktrees.length === 0)
      return archiveSessions(toasts, sessionIds, 'clean')
    setQuestion(asked)
  }
  const answer = (choice: ArchiveAnswer) => {
    const asked = question
    setQuestion(null)
    if (asked === null) return
    if (choice === 'cancel') return
    void archiveSessions(toasts, asked.sessionIds, REMOVAL_FOR_ANSWER[choice])
  }
  return { question, answer, archive }
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
  const archive = useSessionArchive({ add, t }, sessions)
  const selection = useSessionListSelection(sessions, selectedSessionId, {
    onArchiveSelected: (sessionIds) => void archive.archive(sessionIds),
    onSelect,
  })
  const focus = useSessionListFocus(sidebar, sessions, selectedSessionId)
  const [renameTarget, setRenameTarget] = useState<Session | null>(null)
  const menu = { onArchive: selection.archive, onOpenTicket, onRename: setRenameTarget }
  const state = sessionListState(query, sessions.length)
  return (
    <aside
      aria-label={t('sidebarLabel')}
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden"
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
      <SessionArchiveDialog onAnswer={archive.answer} question={archive.question} />
    </aside>
  )
}
