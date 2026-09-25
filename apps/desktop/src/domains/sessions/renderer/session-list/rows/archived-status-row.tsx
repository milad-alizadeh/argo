import { useTranslation } from 'react-i18next'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Alert, AlertDescription, AlertTitle } from '@/platform/renderer/components/ui/alert'
import { sessionFailureState } from '../../session-failure-state'
import type { SessionListRow } from './session-list-rows'
import { SessionListStatusRow } from './session-list-status-row'

// The rows an Archived section's own load state contributes to the merged list, once it is read
// (#2194 follow-up): a session row never carries these, so they live beside it rather than in
// SessionRow. A live search's own status rows (#2375) are the same shape, so they share
// this component rather than a near-duplicate one.
export function ArchivedSectionRow({
  row,
}: {
  row: Extract<
    SessionListRow,
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
      return <SessionListStatusRow label={t('readingArchivedSessions')} />
    case 'archivedLoadingMore':
      return <SessionListStatusRow label={t('loadingMoreArchivedSessions')} />
    case 'archivedError':
      return (
        <Alert
          className="mx-1 border-destructive/50 bg-destructive/10"
          data-state={sessionFailureState(row.error.code)}
          variant="destructive"
        >
          <Icon name="triangle-alert" />
          <AlertTitle>{t('unableToLoadArchivedSessions')}</AlertTitle>
          <AlertDescription>{row.error.message}</AlertDescription>
        </Alert>
      )
    case 'archivedEmpty':
      return <p className="px-2 type-body text-muted-foreground">{t('archivedEmpty')}</p>
    case 'archivedIndexing':
      return <p className="px-2 type-body text-muted-foreground">{t('archivedStillIndexing')}</p>
    case 'searchLoading':
      return <SessionListStatusRow label={t('searchingSessions')} />
    case 'searchLoadingMore':
      return <SessionListStatusRow label={t('loadingMoreSearchResults')} />
    case 'searchError':
      return (
        <Alert
          className="mx-1 border-destructive/50 bg-destructive/10"
          data-state={sessionFailureState(row.error.code)}
          variant="destructive"
        >
          <Icon name="triangle-alert" />
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
