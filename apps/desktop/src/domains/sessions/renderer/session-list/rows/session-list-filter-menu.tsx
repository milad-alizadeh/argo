import { useTranslation } from 'react-i18next'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Button } from '@/platform/renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/platform/renderer/components/ui/dropdown-menu'
import type { SessionListStatus } from '../hooks/use-session-list-filter-store'

// The closed set of filters, each with the catalog key that names it to the reader.
const STATUS_LABELS = {
  active: 'sessionListStatusActive',
  archived: 'sessionListStatusArchived',
  all: 'sessionListStatusAll',
} as const

const STATUSES = Object.keys(STATUS_LABELS) as SessionListStatus[]

export function SessionListFilterMenu({
  onStatusChange,
  status,
}: {
  onStatusChange: (status: SessionListStatus) => void
  status: SessionListStatus
}) {
  const { t } = useTranslation('sessions')
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button aria-label={t('filterSessions')} size="icon-sm" variant="ghost">
            <Icon name="session-list-filter" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
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
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
