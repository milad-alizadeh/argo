import { useTranslation } from 'react-i18next'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Alert, AlertDescription, AlertTitle } from '@/platform/renderer/components/ui/alert'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/platform/renderer/components/ui/empty'
import { SessionListLoading } from './session-list-status-row'

export type SessionListState = 'error' | 'loading' | 'empty' | 'ready'

function NoSessionsFound() {
  const { t } = useTranslation('sessions')
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
}

function SessionListErrorAlert() {
  const { t } = useTranslation('sessions')
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
}

// What the list says instead of rows: the read failed, the first read has not landed, or there are
// no Sessions to show.
export function SessionListOutcome({ state }: { state: SessionListState }) {
  switch (state) {
    case 'error':
      return <SessionListErrorAlert />
    case 'loading':
      return <SessionListLoading />
    case 'empty':
      return <NoSessionsFound />
    case 'ready':
      return null
  }
}
