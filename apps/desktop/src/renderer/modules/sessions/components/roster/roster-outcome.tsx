import { Inbox, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription, AlertTitle } from '../../../../components/ui/alert'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '../../../../components/ui/empty'
import { type RosterStatus, showsActive } from '../../state/use-roster-filter-store'
import type { SessionError, SessionRoster } from '../../types'
import { RosterLoading } from './sessions-sidebar-chrome'

function NoSessionsFound() {
  const { t } = useTranslation('sessions')
  return (
    <Empty className="flex-none px-4 py-8">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Inbox aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{t('noSessionsFound')}</EmptyTitle>
      </EmptyHeader>
    </Empty>
  )
}

function RosterErrorAlert({ error }: { error: SessionError }) {
  const { t } = useTranslation('sessions')
  return (
    <Alert
      className="mx-3 mt-3 w-auto border-destructive/50 bg-destructive/10"
      variant="destructive"
    >
      <TriangleAlert aria-hidden="true" />
      <AlertTitle>{t('unableToLoadSessions')}</AlertTitle>
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
  )
}

// What the list says instead of rows: the read failed, the first read has not landed, or there are
// no Sessions to show. Under a filter that excludes the active roster its emptiness says nothing, so
// the Archive's own empty row speaks instead.
export function RosterOutcome({
  count,
  roster,
  rosterError,
  status,
}: {
  count: number
  roster: SessionRoster | null
  rosterError: SessionError | null
  status: RosterStatus
}) {
  if (rosterError !== null) return <RosterErrorAlert error={rosterError} />
  if (roster === null) return <RosterLoading />
  if (count === 0 && showsActive(status)) return <NoSessionsFound />
  return null
}
