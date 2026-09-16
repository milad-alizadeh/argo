import { Loader2, Plus, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../../components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '../../../../components/ui/input-group'
import { Skeleton } from '../../../../components/ui/skeleton'
import { sessionFailureState } from '../../session-failure-state'
import type { RosterStatus } from '../../state/use-roster-filter-store'
import type { SessionError, SessionRoster } from '../../types'
import { RosterFilterMenu } from './roster-filter-menu'
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
      <Loader2 aria-hidden="true" className="size-4 animate-spin text-muted-foreground" />
    </div>
  )
}

// The bottom of the active roster while the next window arrives.
export function RosterLoadingMoreRow() {
  const { t } = useTranslation('sessions')
  return <RosterStatusRow label={t('loadingMoreSessions')} />
}

export function RosterLoading() {
  return (
    <div aria-label="Reading Sessions" className="space-y-4 px-5 py-4" role="status">
      {[0, 1, 2].map((index) => (
        <div key={index}>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="mt-2 h-3 w-1/3" />
        </div>
      ))}
    </div>
  )
}

export function SessionsSidebarHeader({
  onNew,
  onSearch,
  onStatusChange,
  search,
  status,
}: {
  onNew: () => void
  onSearch: (search: string) => void
  onStatusChange: (status: RosterStatus) => void
  search: string
  status: RosterStatus
}) {
  const { t } = useTranslation('sessions')
  return (
    <header className="flex h-(--size-chrome-bar) shrink-0 items-center border-b border-border/60 pl-4 pr-(--spacing-shell-icon)">
      <InputGroup className="flex-1">
        <InputGroupAddon>
          <Search aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          aria-label={t('searchSessions')}
          className="type-control"
          onChange={(event) => onSearch(event.target.value)}
          placeholder={`${t('searchSessions')}…`}
          value={search}
        />
      </InputGroup>
      <div className="ml-(--spacing-shell-tight) flex items-center">
        <Button aria-label={t('newSession')} onClick={onNew} size="icon-sm" variant="ghost">
          <Plus />
        </Button>
        <RosterFilterMenu onStatusChange={onStatusChange} status={status} />
      </div>
    </header>
  )
}
