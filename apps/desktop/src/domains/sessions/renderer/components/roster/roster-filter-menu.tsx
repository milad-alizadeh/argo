import { SlidersVertical } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { RosterStatus } from '@/domains/sessions/renderer/state/use-roster-filter-store'
import { Button } from '@/platform/renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/platform/renderer/components/ui/dropdown-menu'

// The closed set of filters, each with the catalog key that names it to the reader.
const STATUS_LABELS = {
  active: 'rosterStatusActive',
  archived: 'rosterStatusArchived',
  all: 'rosterStatusAll',
} as const

const STATUSES = Object.keys(STATUS_LABELS) as RosterStatus[]

export function RosterFilterMenu({
  onStatusChange,
  status,
}: {
  onStatusChange: (status: RosterStatus) => void
  status: RosterStatus
}) {
  const { t } = useTranslation('sessions')
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button aria-label={t('filterSessions')} size="icon-sm" variant="ghost">
            <SlidersVertical />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          onValueChange={(value) => onStatusChange(value as RosterStatus)}
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
