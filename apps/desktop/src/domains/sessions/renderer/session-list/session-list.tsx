import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useToastManager } from '@/platform/renderer/components/ui/toast'
import type { trpcClient } from '@/platform/renderer/trpc-client'
import { useArchiveAction } from './hooks/use-archive-action'
import { useSessionListPage } from './hooks/use-session-list-page'
import {
  IndexedSessionRenameDialog,
  useIndexedRename,
} from './rename/indexed-session-rename-dialog'
import { SessionListVirtualList } from './rows/session-list-virtual-list'
import { SessionsSidebarHeader } from './sidebar/sessions-sidebar-chrome'

export type SessionListActions = {
  onNew: () => void
  onSelect: (sessionId: string) => void
}

function useSyncFailure(harness: 'Claude' | 'Codex', failure: string | null) {
  const { add, close } = useToastManager()
  const { t } = useTranslation('sessions')
  useEffect(() => {
    if (failure === null) return
    const id = add({
      title: t('sessionList.syncFailed', { harness }),
      description: failure,
      type: 'error',
      priority: 'high',
      timeout: 0,
    })
    return () => close(id)
  }, [add, close, failure, harness, t])
}

function SyncStatus({
  harness,
  state,
  refreshedAt,
  indexedCount,
  invalidRecordCount,
}: {
  harness: string
  state: string
  refreshedAt: number | null
  indexedCount: number
  invalidRecordCount: number
}) {
  const { t } = useTranslation('sessions')
  return (
    <span>
      {harness}: {state === 'syncing' ? t('sessionList.syncing') : t('sessionList.lastSynced')}{' '}
      {refreshedAt === null
        ? t('sessionList.neverSynced')
        : new Date(refreshedAt).toLocaleTimeString()}
      {' · '}
      {t('sessionList.indexedCount', { count: indexedCount })}
      {invalidRecordCount > 0
        ? ` · ${t('sessionList.invalidCount', { count: invalidRecordCount })}`
        : null}
    </span>
  )
}

type SyncStatusResult = Awaited<ReturnType<typeof trpcClient.sessionSyncStatus.query>>

function SyncFooter({ status }: { status: SyncStatusResult | undefined }) {
  if (status === undefined) return null
  return (
    <div className="flex shrink-0 gap-3 border-t border-border/60 px-3 py-1 type-meta text-faint">
      <SyncStatus harness="Claude" {...status.claude} />
      <SyncStatus harness="Codex" {...status.codex} />
    </div>
  )
}

function emptyListKey(status: 'active' | 'archived' | 'all', search: string) {
  if (status === 'archived') return 'archivedEmpty'
  if (search.trim().length > 0) return 'noSearchResults'
  return 'empty.sessionList.title'
}

export function SessionList({
  actions,
  projectId,
  selectedSessionId,
}: {
  actions: SessionListActions
  projectId: string | null
  selectedSessionId: string | null
}) {
  const { t } = useTranslation('sessions')
  const {
    search,
    setSearch,
    status,
    setStatus,
    syncStatus,
    sessionList,
    visible,
    selection,
    liveStatuses,
  } = useSessionListPage(projectId, selectedSessionId)
  useSyncFailure('Claude', syncStatus.data?.claude.failure ?? null)
  useSyncFailure('Codex', syncStatus.data?.codex.failure ?? null)
  const rename = useIndexedRename()
  const archive = useArchiveAction(selection.clear)
  return (
    <aside
      aria-label={t('sidebarLabel')}
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-sidebar"
    >
      <SessionsSidebarHeader
        onNew={actions.onNew}
        onSearch={setSearch}
        onStatusChange={setStatus}
        search={search}
        status={status}
      />
      {sessionList.isPending ? <p className="p-3 type-meta text-faint">{t('loading')}</p> : null}
      {sessionList.isError ? (
        <p className="p-3 type-meta text-danger">{t('sessionList.readFailure')}</p>
      ) : null}
      {sessionList.isSuccess && visible.length === 0 ? (
        <p className="p-3 type-body text-muted-foreground">{t(emptyListKey(status, search))}</p>
      ) : null}
      <SessionListVirtualList
        sessions={visible}
        liveStatuses={liveStatuses}
        selectedSessionId={selectedSessionId}
        onSelect={(sessionId) => {
          selection.clear()
          actions.onSelect(sessionId)
        }}
        selectedIds={selection.selectedIds}
        onToggleSelect={selection.toggle}
        onArchive={(sessionIds, archived) => void archive(sessionIds, archived)}
        onRename={rename.open}
        hasNextPage={sessionList.hasNextPage}
        isFetchingNextPage={sessionList.isFetchingNextPage}
        onFetchNextPage={() => void sessionList.fetchNextPage()}
      />
      <IndexedSessionRenameDialog
        key={rename.key}
        session={rename.session}
        onClose={rename.close}
      />
      <SyncFooter status={syncStatus.data} />
    </aside>
  )
}
