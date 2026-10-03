import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/platform/renderer/components/design-system/empty-state'
import { Notice } from '@/platform/renderer/components/design-system/notice'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Skeleton } from '@/platform/renderer/components/ui/skeleton'
import { SESSION_LIST_ROW_HEIGHT } from './session-row'

export type SessionListState = 'error' | 'loading' | 'empty' | 'ready'

const sessionLoadingRecipe = {
  row: 'flex items-start gap-2 px-2 py-2',
  mark: 'mt-0.5 size-4 shrink-0 rounded-full',
  content: 'min-w-0 flex-1',
  title: 'h-4 w-3/4',
  detail: 'mt-1.5 h-3 w-1/3',
} as const

// The existing placeholder shape uses the virtualizer's estimate.
function SessionListLoading() {
  const { t } = useTranslation('sessions')
  return (
    <div aria-label={t('readingSessions')} role="status">
      {[0, 1, 2].map((index) => (
        <div
          className={sessionLoadingRecipe.row}
          key={index}
          style={{ height: SESSION_LIST_ROW_HEIGHT }}
        >
          <Skeleton className={sessionLoadingRecipe.mark} />
          <div className={sessionLoadingRecipe.content}>
            <Skeleton className={sessionLoadingRecipe.title} />
            <Skeleton className={sessionLoadingRecipe.detail} />
          </div>
        </div>
      ))}
    </div>
  )
}

// What the list says instead of rows: the read failed, the first read has not landed, or no rows.
export function SessionListOutcome({ state }: { state: SessionListState }) {
  const { t } = useTranslation('sessions')
  switch (state) {
    case 'error':
      return (
        <Notice
          className="mx-3 mt-3 w-auto"
          heading={t('unableToLoadSessions')}
          icon="triangle-alert"
          tone="danger"
        >
          {t('sessionListReadFailure')}
        </Notice>
      )
    case 'loading':
      return <SessionListLoading />
    case 'empty':
      return (
        <EmptyState
          media={<Icon name="no-sessions" />}
          size="compact"
          title={t('noSessionsFound')}
        />
      )
    case 'ready':
      return null
  }
}
