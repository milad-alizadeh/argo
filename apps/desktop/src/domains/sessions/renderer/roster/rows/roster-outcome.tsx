import { useTranslation } from 'react-i18next'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Alert, AlertDescription, AlertTitle } from '@/platform/renderer/components/ui/alert'
import { Button } from '@/platform/renderer/components/ui/button'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/platform/renderer/components/ui/empty'
import type { SessionError, SessionRoster } from '../../types'
import { type RosterStatus, showsActive } from '../hooks/use-roster-filter-store'
import { RosterLoading } from './roster-status-row'

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

function RosterErrorAlert({
  error,
  failureCount,
  onRetry,
}: {
  error: SessionError
  failureCount: number
  onRetry: () => void
}) {
  const { t } = useTranslation('sessions')
  return (
    <Alert
      className="mx-3 mt-3 w-auto border-destructive/50 bg-destructive/10"
      variant="destructive"
    >
      <Icon name="triangle-alert" />
      <AlertTitle>{t('unableToLoadSessions')}</AlertTitle>
      <AlertDescription>
        {error.message} {t('roster.failureCount', { count: failureCount })}
        <Button className="mt-2" onClick={onRetry} size="sm" variant="outline">
          {t('roster.retry')}
        </Button>
      </AlertDescription>
    </Alert>
  )
}

// What the list says instead of rows: the read failed, the first read has not landed, or there are
// no Sessions to show. Under a filter that excludes the active roster its emptiness says nothing, so
// the Archive's own empty row speaks instead.
export function RosterOutcome({
  count,
  roster,
  queryFailure,
  status,
}: {
  count: number
  roster: SessionRoster | null
  queryFailure: { error: SessionError | null; failureCount: number; retry: () => void }
  status: RosterStatus
}) {
  if (queryFailure.error !== null)
    return (
      <RosterErrorAlert
        error={queryFailure.error}
        failureCount={queryFailure.failureCount}
        onRetry={queryFailure.retry}
      />
    )
  if (roster === null) return <RosterLoading />
  if (count === 0 && showsActive(status)) return <NoSessionsFound />
  return null
}
