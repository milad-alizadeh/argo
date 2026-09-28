import { useTranslation } from 'react-i18next'
import { Icon } from '@/platform/renderer/components/icon/icon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from '@/platform/renderer/components/ui/dropdown-menu'
import { MenuDropdownTrigger } from '@/platform/renderer/components/ui/dropdown-trigger'
import type { SessionListStatus } from '../hooks/use-session-list-filter-store'

// The closed set of filters, each with the catalog key that names it to the reader.
const STATUS_LABELS = {
  active: 'sessionListStatusActive',
  archived: 'sessionListStatusArchived',
  all: 'sessionListStatusAll',
} as const

const STATUSES = Object.keys(STATUS_LABELS) as SessionListStatus[]

export function SessionListFilterMenu({
  onRefresh,
  onStatusChange,
  refreshing,
  status,
}: {
  onRefresh: () => void
  onStatusChange: (status: SessionListStatus) => void
  refreshing: boolean
  status: SessionListStatus
}) {
  const { t } = useTranslation('sessions')
  return (
    <DropdownMenu>
      <MenuDropdownTrigger
        aria-label={t('filterSessions')}
        icon="session-list-filter"
        iconOnly
        label={t('filterSessions')}
        variant="ghost"
      />
      <DropdownMenuContent align="end" className="w-max">
        <DropdownMenuRadioGroup
          onValueChange={(value) => onStatusChange(value as SessionListStatus)}
          value={status}
        >
          {STATUSES.map((value) => (
            <DropdownMenuRadioItem key={value} value={value}>
              {t(STATUS_LABELS[value])}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="whitespace-nowrap type-control"
          disabled={refreshing}
          onClick={onRefresh}
        >
          <Icon name="retry" />
          {t('refreshSessions')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
