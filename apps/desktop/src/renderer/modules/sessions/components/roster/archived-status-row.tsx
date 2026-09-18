import { TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription, AlertTitle } from '@/platform/renderer/components/ui/alert'
import { sessionFailureState } from '../../session-failure-state'
import type { RosterRow } from './roster-rows'
import { RosterStatusRow } from './sessions-sidebar-chrome'

// The rows an Archived section's own load state contributes to the merged list, once it is read
// (#2194 follow-up): a session row never carries these, so they live beside it rather than in
// SessionRosterItem.
export function ArchivedSectionRow({
  row,
}: {
  row: Extract<
    RosterRow,
    {
      kind:
        | 'archivedLoading'
        | 'archivedLoadingMore'
        | 'archivedError'
        | 'archivedEmpty'
        | 'archivedIndexing'
    }
  >
}) {
  const { t } = useTranslation('sessions')
  switch (row.kind) {
    case 'archivedLoading':
      return <RosterStatusRow label={t('readingArchivedSessions')} />
    case 'archivedLoadingMore':
      return <RosterStatusRow label={t('loadingMoreArchivedSessions')} />
    case 'archivedError':
      return (
        <Alert
          className="mx-1 border-destructive/50 bg-destructive/10"
          data-state={sessionFailureState(row.error.code)}
          variant="destructive"
        >
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>{t('unableToLoadArchivedSessions')}</AlertTitle>
          <AlertDescription>{row.error.message}</AlertDescription>
        </Alert>
      )
    case 'archivedEmpty':
      return <p className="px-2 type-body text-muted-foreground">{t('archivedEmpty')}</p>
    case 'archivedIndexing':
      return <p className="px-2 type-body text-muted-foreground">{t('archivedStillIndexing')}</p>
    default:
      return null
  }
}
