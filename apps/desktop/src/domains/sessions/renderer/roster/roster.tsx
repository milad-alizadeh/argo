import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToastManager } from '@/platform/renderer/components/ui/toast'
import { trpc, trpcClient } from '@/platform/renderer/trpc-client'
import { useSessionCreationStore } from '../session-creation'
import { useWatchedQueries } from '../use-watched-topic'
import { useRosterFilterStore } from './hooks/use-roster-filter-store'
import type { RosterActions } from './rows/roster-actions'
import { RosterVirtualList } from './rows/roster-virtual-list'
import { SessionsSidebarHeader } from './sidebar/sessions-sidebar-chrome'

export type { RosterActions } from './rows'

const PAGE_SIZE = 50

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

function sessionListOptions(projectId: string | null, search: string) {
  return {
    queryKey: trpc.sessions.list.queryKey({ projectId, search }),
    initialPageParam: 1,
    queryFn: ({ pageParam }: { pageParam: number }) =>
      trpcClient.sessions.list.query({ page: pageParam, pageSize: PAGE_SIZE, projectId, search }),
    getNextPageParam: (lastPage: Awaited<ReturnType<typeof trpcClient.sessions.list.query>>) =>
      lastPage.page * lastPage.pageSize < lastPage.indexedTotal ? lastPage.page + 1 : undefined,
  }
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
  const [search, setSearch] = useState('')
  const status = useRosterFilterStore((state) => state.status)
  const pending = useSessionCreationStore((state) => state.pending)
  const setStatus = useRosterFilterStore((state) => state.setStatus)
  useWatchedQueries('sessions', [
    trpc.sessions.list.queryKey({ projectId, search }),
    trpc.sessionSyncStatus.queryKey(),
  ])
  const syncStatus = useQuery(trpc.sessionSyncStatus.queryOptions())
  useSyncFailure('Claude', syncStatus.data?.claude.failure ?? null)
  useSyncFailure('Codex', syncStatus.data?.codex.failure ?? null)
  const roster = useInfiniteQuery(sessionListOptions(projectId, search))
  const indexed = useMemo(
    () => roster.data?.pages.flatMap((page) => page.sessions) ?? [],
    [roster.data],
  )
  useEffect(() => {
    if (pending?.stage === 'reconciling' && indexed.some(({ argoId }) => argoId === pending.id))
      useSessionCreationStore.getState().confirmed(pending.id)
  }, [indexed, pending])
  const visible = useMemo(() => {
    if (status === 'archived') return []
    if (
      pending === null ||
      search.trim().length > 0 ||
      indexed.some(({ argoId }) => argoId === pending.id)
    )
      return indexed
    return [pending, ...indexed]
  }, [indexed, pending, search, status])
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
      <RosterVirtualList
        sessions={visible}
        selectedSessionId={selectedSessionId}
        onSelect={actions.onSelect}
        hasNextPage={roster.hasNextPage && status !== 'archived'}
        isFetchingNextPage={roster.isFetchingNextPage}
        onFetchNextPage={() => void roster.fetchNextPage()}
      />
      <SyncFooter status={syncStatus.data} />
    </aside>
  )
}
