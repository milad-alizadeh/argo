import { useTranslation } from 'react-i18next'
import { sessionFailureState } from '@/domains/sessions/renderer/session-failure-state'
import type { SessionError, SessionRoster } from '@/domains/sessions/renderer/types'
import { Icon } from '@/platform/renderer/components/icon'
import { Skeleton } from '@/platform/renderer/components/ui/skeleton'
import { ROSTER_ROW_HEIGHT } from './roster-rows'

export function rosterState(
  roster: SessionRoster | null,
  rosterError: SessionError | null,
  count: number,
) {
  if (rosterError !== null) return sessionFailureState(rosterError.code)
  if (roster === null) return 'loading'
  return count === 0 ? 'empty' : 'ready'
}

// The one spinner every roster load-more state draws, so the active roster and the Archive read the
// same at the point where the list is still growing. It takes one row's height, the height of the
// Session row it stands in for, and centers the spinner in it.
export function RosterStatusRow({ label }: { label: string }) {
  return (
    <div
      aria-label={label}
      className="flex items-center justify-center"
      role="status"
      style={{ height: ROSTER_ROW_HEIGHT }}
    >
      <Icon name="loading" className="size-4 animate-spin text-muted-foreground" />
    </div>
  )
}

// The bottom of the active roster while the next window arrives.
export function RosterLoadingMoreRow() {
  const { t } = useTranslation('sessions')
  return <RosterStatusRow label={t('loadingMoreSessions')} />
}

export function RosterLoading() {
  const { t } = useTranslation('sessions')
  return (
    <div aria-label={t('readingSessions')} className="space-y-4 px-5 py-4" role="status">
      {[0, 1, 2].map((index) => (
        <div key={index}>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="mt-2 h-3 w-1/3" />
        </div>
      ))}
    </div>
  )
}
