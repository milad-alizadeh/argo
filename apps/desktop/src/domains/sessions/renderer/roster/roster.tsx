import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { trpc } from '@/platform/renderer/trpc-client'
import type { RosterActions } from './rows/roster-actions'

export type { RosterActions } from './rows'

const PAGE_SIZE = 50

function sessionTitle(session: {
  vendorTitle: string | null
  firstPrompt: string | null
  nativeId: string
}): string {
  return session.vendorTitle ?? session.firstPrompt ?? session.nativeId
}

export function Roster({
  actions,
  selectedSessionId,
}: {
  actions: Pick<RosterActions, 'onNew' | 'onSelect'>
  projectRoot: string | null
  selectedSessionId: string | null
}) {
  const { t } = useTranslation('sessions')
  const [page, setPage] = useState(1)
  const roster = useQuery(
    trpc.sessionPage.queryOptions({ page, pageSize: PAGE_SIZE, projectId: null }),
  )
  const sessions = roster.data?.sessions ?? []
  const canGoBack = page > 1
  const canGoForward = roster.data !== undefined && page * PAGE_SIZE < roster.data.indexedTotal
  return (
    <aside aria-label={t('sidebarLabel')} className="flex h-full min-h-0 flex-col bg-sidebar">
      <div className="flex items-center justify-between gap-2 border-b p-2">
        <span className="text-sm font-medium">{t('title')}</span>
        <button onClick={actions.onNew} type="button">
          {t('newSession')}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {roster.isLoading ? <p className="p-3 text-sm">{t('loading')}</p> : null}
        {roster.isError ? <p className="p-3 text-sm">{t('roster.readFailure')}</p> : null}
        {sessions.map((session) => (
          <button
            aria-current={session.argoId === selectedSessionId ? 'page' : undefined}
            className="block w-full border-b px-3 py-2 text-left"
            key={session.argoId}
            onClick={() => actions.onSelect(session.argoId)}
            type="button"
          >
            <span className="block truncate text-sm">{sessionTitle(session)}</span>
            <span className="block text-xs text-muted-foreground">{session.harness}</span>
          </button>
        ))}
      </div>
      <div className="flex justify-between border-t p-2">
        <button
          disabled={!canGoBack}
          onClick={() => setPage((current) => current - 1)}
          type="button"
        >
          {t('roster.previousPage')}
        </button>
        <span className="text-xs">{t('roster.page', { page })}</span>
        <button
          disabled={!canGoForward}
          onClick={() => setPage((current) => current + 1)}
          type="button"
        >
          {t('roster.nextPage')}
        </button>
      </div>
    </aside>
  )
}
