import { useTranslation } from 'react-i18next'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Alert, AlertDescription, AlertTitle } from '@/platform/renderer/components/ui/alert'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/platform/renderer/components/ui/empty'
import type { SessionError, SessionRoster } from '../../types'
import { type SessionListStatus, showsActive } from '../hooks/use-session-list-filter-store'
import { SessionListLoading } from './session-list-status-row'

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

function SessionListErrorAlert({ error }: { error: SessionError }) {
  const { t } = useTranslation('sessions')
  return (
    <Alert
      className="mx-3 mt-3 w-auto border-destructive/50 bg-destructive/10"
      variant="destructive"
    >
      <Icon name="triangle-alert" />
      <AlertTitle>{t('unableToLoadSessions')}</AlertTitle>
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
  )
}

// What the list says instead of rows: the read failed, the first read has not landed, or there are
// no Sessions to show. Under a filter that excludes the active Session list its emptiness says nothing, so
// the Archive's own empty row speaks instead.
export function SessionListOutcome({
  count,
  sessionList,
  sessionListError,
  status,
}: {
  count: number
  sessionList: SessionRoster | null
  sessionListError: SessionError | null
  status: SessionListStatus
}) {
  if (sessionListError !== null) return <SessionListErrorAlert error={sessionListError} />
  if (sessionList === null) return <SessionListLoading />
  if (count === 0 && showsActive(status)) return <NoSessionsFound />
  return null
}
