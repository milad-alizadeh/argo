import { useTranslation } from 'react-i18next'
import { MenuDropdownTrigger } from '@/platform/renderer/components/dropdown-trigger'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { SidebarSearch } from '@/platform/renderer/components/sidebar-search'
import { Button } from '@/platform/renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from '@/platform/renderer/components/ui/dropdown-menu'
import { Progress } from '@/platform/renderer/components/ui/progress'
import { FILTER_LABELS, type SessionListFilter } from './session-list-query'
import { type SessionSyncStatus, useSessionSync } from './use-session-sync'

const FILTERS = Object.keys(FILTER_LABELS) as SessionListFilter[]

function SessionSyncFeedback({ status }: { status: SessionSyncStatus | null }) {
  const { t } = useTranslation('sessions')
  if (status === null || (status.phase !== 'fetching' && status.phase !== 'saving')) return null
  // Indeterminate until the worker knows how many Sessions it saves; none to save is complete.
  let progress: number | null = null
  if (status.phase === 'saving' && status.total !== null)
    progress = status.total === 0 ? 100 : (status.processed / status.total) * 100
  return (
    <div
      className="border-b border-border/60 px-4 py-2 type-meta text-muted-foreground"
      role="status"
    >
      <div className="flex items-center gap-2">
        <Progress aria-label={t('sync.progress')} className="min-w-0 flex-1" value={progress} />
        <span>
          {progress === null
            ? t('sync.fetching')
            : t('sync.saving', { processed: status.processed, total: status.total })}
        </span>
      </div>
    </div>
  )
}

function SessionListFilterMenu({
  filter,
  onFilterChange,
  sync,
}: {
  filter: SessionListFilter
  onFilterChange: (filter: SessionListFilter) => void
  sync: { refresh: () => void; refreshing: boolean }
}) {
  const { t } = useTranslation('sessions')
  return (
    <DropdownMenu>
      <MenuDropdownTrigger
        appearance="menu"
        aria-label={t('filterSessions')}
        icon="session-list-filter"
        iconOnly
        label={t('filterSessions')}
      />
      <DropdownMenuContent align="end" className="w-max">
        <DropdownMenuRadioGroup
          onValueChange={(value) => onFilterChange(value as SessionListFilter)}
          value={filter}
        >
          {FILTERS.map((value) => (
            <DropdownMenuRadioItem key={value} value={value}>
              {t(FILTER_LABELS[value])}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="whitespace-nowrap type-control"
          disabled={sync.refreshing}
          onClick={sync.refresh}
        >
          <Icon name="retry" />
          {t('refreshSessions')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// The search, the filter with its Refresh, New Session, and the History sync Refresh starts.
export function SessionListHeader({
  filter,
  onFilterChange,
  onNew,
  search,
  setSearch,
}: {
  filter: SessionListFilter
  onFilterChange: (filter: SessionListFilter) => void
  onNew: () => void
  search: string
  setSearch: (search: string) => void
}) {
  const { t } = useTranslation('sessions')
  const sync = useSessionSync()
  return (
    <>
      <header className="flex h-(--size-chrome-bar) sidebar-gutter shrink-0 items-center">
        <SidebarSearch
          label={t('searchSessions')}
          onChange={setSearch}
          placeholder={`${t('searchSessions')}…`}
          value={search}
        />
        {/* The filter sits left of the plus, so the plus keeps the right edge every row lines up on. */}
        <div className="ml-(--spacing-shell-tight) flex items-center">
          <SessionListFilterMenu filter={filter} onFilterChange={onFilterChange} sync={sync} />
          <Button
            aria-label={t('newSession')}
            className="-mr-1.5"
            onClick={onNew}
            size="icon-sm"
            variant="ghost"
          >
            <Icon name="add" />
          </Button>
        </div>
      </header>
      <SessionSyncFeedback status={sync.status} />
    </>
  )
}
