import { TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { RosterRow } from '@/domains/sessions/renderer/components/roster/roster-rows'
import { RosterStatusRow } from '@/domains/sessions/renderer/components/roster/sessions-sidebar-chrome'
import { sessionFailureState } from '@/domains/sessions/renderer/session-failure-state'
import { Alert, AlertDescription, AlertTitle } from '@/platform/renderer/components/ui/alert'

// The rows an Archived section's own load state contributes to the merged list, once it is read
// (#2194 follow-up): a session row never carries these, so they live beside it rather than in
// SessionRosterItem. A live search's own status rows (#2375) are the same shape, so they share
// this component rather than a near-duplicate one.
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
        | 'searchLoading'
        | 'searchLoadingMore'
        | 'searchError'
        | 'searchEmpty'
        | 'searchIndexing'
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
    case 'searchLoading':
      return <RosterStatusRow label={t('searchingSessions')} />
    case 'searchLoadingMore':
      return <RosterStatusRow label={t('loadingMoreSearchResults')} />
    case 'searchError':
      return (
        <Alert
          className="mx-1 border-destructive/50 bg-destructive/10"
          data-state={sessionFailureState(row.error.code)}
          variant="destructive"
        >
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>{t('unableToSearchSessions')}</AlertTitle>
          <AlertDescription>{row.error.message}</AlertDescription>
        </Alert>
      )
    case 'searchEmpty':
      return <p className="px-2 type-body text-muted-foreground">{t('noSearchResults')}</p>
    case 'searchIndexing':
      return <p className="px-2 type-body text-muted-foreground">{t('searchStillIndexing')}</p>
    default:
      return null
  }
}
