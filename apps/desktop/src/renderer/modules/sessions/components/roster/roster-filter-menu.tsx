import { SlidersVertical } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/renderer/components/ui/dropdown-menu'
import type { RosterStatus } from '../../state/use-roster-filter-store'

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
  const labelOf = (value: RosterStatus) => t(STATUS_LABELS[value])
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
        <DropdownMenuSub>
          {/* The chosen status reads on the trigger, so the filter in force is legible without
              opening the submenu. */}
          <DropdownMenuSubTrigger>
            {t('rosterStatusLabel')}
            <span className="ml-auto pl-4 text-muted-foreground">{labelOf(status)}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              onValueChange={(value) => onStatusChange(value as RosterStatus)}
              value={status}
            >
              {STATUSES.map((value) => (
                <DropdownMenuRadioItem key={value} value={value}>
                  {labelOf(value)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
