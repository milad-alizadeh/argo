import { useTranslation } from 'react-i18next'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Button } from '@/platform/renderer/components/ui/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/platform/renderer/components/ui/input-group'
import type { SessionListStatus } from '../hooks/use-session-list-filter-store'
import { SessionListFilterMenu } from '../rows/session-list-filter-menu'

export function SessionsSidebarHeader({
  onNew,
  onRefresh,
  onSearch,
  onStatusChange,
  refreshing,
  search,
  status,
}: {
  onNew: () => void
  onRefresh: () => void
  onSearch: (search: string) => void
  onStatusChange: (status: SessionListStatus) => void
  refreshing: boolean
  search: string
  status: SessionListStatus
}) {
  const { t } = useTranslation('sessions')
  return (
    <header className="flex h-(--size-chrome-bar) shrink-0 items-center border-b border-border/60 pl-4 pr-(--spacing-shell-icon)">
      <InputGroup className="flex-1">
        <InputGroupAddon>
          <Icon name="search" />
        </InputGroupAddon>
        <InputGroupInput
          aria-label={t('searchSessions')}
          className="type-control"
          onChange={(event) => onSearch(event.target.value)}
          placeholder={`${t('searchSessions')}…`}
          value={search}
        />
      </InputGroup>
      {/* The filter sits left of the plus, so the plus keeps the right edge every row lines up on. */}
      <div className="ml-(--spacing-shell-tight) flex items-center">
        <Button
          aria-label={t('refreshSessions')}
          disabled={refreshing}
          onClick={onRefresh}
          size="icon-sm"
          variant="ghost"
        >
          <Icon name="retry" />
        </Button>
        <SessionListFilterMenu onStatusChange={onStatusChange} status={status} />
        <Button aria-label={t('newSession')} onClick={onNew} size="icon-sm" variant="ghost">
          <Icon name="add" />
        </Button>
      </div>
    </header>
  )
}
