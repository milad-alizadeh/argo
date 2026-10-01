import { useTranslation } from 'react-i18next'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Alert, AlertDescription, AlertTitle } from '@/platform/renderer/components/ui/alert'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/platform/renderer/components/ui/empty'
import { Skeleton } from '@/platform/renderer/components/ui/skeleton'
import { SESSION_LIST_ROW_HEIGHT } from './session-row'

export type SessionListState = 'error' | 'loading' | 'empty' | 'ready'

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
export function SessionListOutcome({ state }: { state: SessionListState }) {
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
