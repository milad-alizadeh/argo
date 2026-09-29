import { useTranslation } from 'react-i18next'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { SidebarSearch } from '@/platform/renderer/components/sidebar-search'
import { Button } from '@/platform/renderer/components/ui/button'
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
    <header className="flex h-(--size-chrome-bar) sidebar-gutter shrink-0 items-center">
      <SidebarSearch
        label={t('searchSessions')}
        onChange={onSearch}
        placeholder={`${t('searchSessions')}…`}
        value={search}
      />
      {/* The filter sits left of the plus, so the plus keeps the right edge every row lines up on. */}
      <div className="ml-(--spacing-shell-tight) flex items-center">
        <SessionListFilterMenu
          onRefresh={onRefresh}
          onStatusChange={onStatusChange}
          refreshing={refreshing}
          status={status}
        />
        <Button aria-label={t('newSession')} onClick={onNew} size="icon-sm" variant="ghost">
          <Icon name="add" />
        </Button>
      </div>
    </header>
  )
}
