import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useToastManager } from '@/platform/renderer/components/ui/toast'
import type { trpcClient } from '@/platform/renderer/trpc-client'
import { useArchiveAction } from './hooks/use-archive-action'
import { useRosterPage } from './hooks/use-roster-page'
import {
  IndexedSessionRenameDialog,
  useIndexedRename,
} from './rename/indexed-session-rename-dialog'
import type { RosterActions } from './rows/roster-actions'
import { RosterVirtualList } from './rows/roster-virtual-list'
import { SessionsSidebarHeader } from './sidebar/sessions-sidebar-chrome'

export type { RosterActions } from './rows'

function useSyncFailure(harness: 'Claude' | 'Codex', failure: string | null) {
  const { add, close } = useToastManager()
  const { t } = useTranslation('sessions')
  useEffect(() => {
    if (failure === null) return
    const id = add({
      title: t('roster.syncFailed', { harness }),
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
      {harness}: {state === 'syncing' ? t('roster.syncing') : t('roster.lastSynced')}{' '}
      {refreshedAt === null ? t('roster.neverSynced') : new Date(refreshedAt).toLocaleTimeString()}
      {' · '}
      {t('roster.indexedCount', { count: indexedCount })}
      {invalidRecordCount > 0
        ? ` · ${t('roster.invalidCount', { count: invalidRecordCount })}`
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
  return 'empty.roster.title'
}

export function Roster({
  actions,
  projectId,
  selectedSessionId,
}: {
  actions: Pick<RosterActions, 'onNew' | 'onSelect'>
  projectId: string | null
  selectedSessionId: string | null
}) {
  const { t } = useTranslation('sessions')
  const { search, setSearch, status, setStatus, syncStatus, roster, visible, selection } =
    useRosterPage(projectId, selectedSessionId)
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
      {roster.isPending ? <p className="p-3 type-meta text-faint">{t('loading')}</p> : null}
      {roster.isError ? (
        <p className="p-3 type-meta text-danger">{t('roster.readFailure')}</p>
      ) : null}
      {roster.isSuccess && visible.length === 0 ? (
        <p className="p-3 type-body text-muted-foreground">{t(emptyListKey(status, search))}</p>
      ) : null}
      <RosterVirtualList
        sessions={visible}
        selectedSessionId={selectedSessionId}
        onSelect={(sessionId) => {
          selection.clear()
          actions.onSelect(sessionId)
        }}
        selectedIds={selection.selectedIds}
        onToggleSelect={selection.toggle}
        onArchive={(sessionIds, archived) => void archive(sessionIds, archived)}
        onRename={rename.open}
        hasNextPage={roster.hasNextPage}
        isFetchingNextPage={roster.isFetchingNextPage}
        onFetchNextPage={() => void roster.fetchNextPage()}
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
