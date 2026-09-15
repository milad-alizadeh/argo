import { ChevronRight, Loader2, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription, AlertTitle } from '@/renderer/components/ui/alert'
import { sessionFailureState } from '../../session-failure-state'
import type { RosterRow } from './roster-rows'

export function ArchivedToggleRow({
  archivedLabel,
  onToggle,
  open,
}: {
  archivedLabel: string
  onToggle: () => void
  open: boolean
}) {
  return (
    <button
      aria-expanded={open}
      className="group flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left type-body text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      data-slot="archived-toggle"
      onClick={onToggle}
      type="button"
    >
      <ChevronRight
        aria-hidden="true"
        className="size-(--size-icon-inline) shrink-0 transition-transform group-aria-expanded:rotate-90"
      />
      <span>{archivedLabel}</span>
    </button>
  )
}

function ArchivedStatus({ label }: { label: string }) {
  return (
    <div aria-label={label} className="px-2 py-2" role="status">
      <Loader2 aria-hidden="true" className="size-4 animate-spin text-muted-foreground" />
    </div>
  )
}

// The rows an Archived section's own load state contributes to the merged list, once it is open
// (#2194 follow-up): a session row never carries these, so they live beside it rather than in
// SessionRosterItem.
export function ArchivedSectionRow({
  row,
}: {
  row: Extract<
    RosterRow,
    { kind: 'archivedLoading' | 'archivedLoadingMore' | 'archivedError' | 'archivedEmpty' }
  >
}) {
  const { t } = useTranslation('sessions')
  switch (row.kind) {
    case 'archivedLoading':
      return <ArchivedStatus label={t('readingArchivedSessions')} />
    case 'archivedLoadingMore':
      return <ArchivedStatus label={t('loadingMoreArchivedSessions')} />
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
    default:
      return null
  }
}
