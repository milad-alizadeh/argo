import { useTranslation } from 'react-i18next'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Skeleton } from '@/platform/renderer/components/ui/skeleton'
import { SESSION_LIST_ROW_HEIGHT } from './session-list-rows'

// The bottom of the list while the next page arrives: one row tall, the spinner centred in it.
export function SessionListLoadingMoreRow() {
  const { t } = useTranslation('sessions')
  return (
    <div
      aria-label={t('loadingMoreSessions')}
      className="flex items-center justify-center"
      role="status"
      style={{ height: SESSION_LIST_ROW_HEIGHT }}
    >
      <Icon name="loading" className="size-4 animate-spin text-muted-foreground" />
    </div>
  )
}

// A skeleton row previews the shape of the Session row it is about to become
// (session-row.tsx): the same icon mark, gap and padding, at the same
// SESSION_LIST_ROW_HEIGHT, so nothing reflows once real rows arrive.
function SessionListLoadingRow() {
  return (
    <div className="flex items-start gap-2 px-2 py-2" style={{ height: SESSION_LIST_ROW_HEIGHT }}>
      <Skeleton className="mt-0.5 size-4 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="mt-1.5 h-3 w-1/3" />
      </div>
    </div>
  )
}

export function SessionListLoading() {
  const { t } = useTranslation('sessions')
  return (
    <div aria-label={t('readingSessions')} role="status">
      {[0, 1, 2].map((index) => (
        <SessionListLoadingRow key={index} />
      ))}
    </div>
  )
}
