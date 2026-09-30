import { useTranslation } from 'react-i18next'

import type { TicketPriority } from '@/domains/tickets/api/ticket'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/platform/renderer/components/ui/dropdown-menu'
import { ticketMenuTrigger } from './ticket-menu-trigger'
import { NO_PRIORITY_LABEL, PriorityIcon, priorityName } from './ticket-status'

export type PriorityMenuProps = {
  priority: TicketPriority | null
  // The provider's declared choices; No priority is always offered beside them.
  choices: readonly TicketPriority[]
  named: boolean
  metadata?: boolean
  writable?: boolean
  onChange: (priority: TicketPriority | null) => void
}

const priorityValue = (priority: TicketPriority | null) =>
  priority ? String(priority.level) : 'none'

// The priority without its choices, for a Ticket whose Account cannot be called.
function StaticPriority({ priority, named }: Pick<PriorityMenuProps, 'priority' | 'named'>) {
  return (
    <span className="flex items-center gap-(--spacing-shell-tight) type-meta text-muted-foreground">
      <PriorityIcon priority={priority} />
      {named ? priorityName(priority) : <span className="sr-only">{priorityName(priority)}</span>}
    </span>
  )
}

export function PriorityMenu({
  priority,
  choices,
  named,
  metadata = false,
  writable = true,
  onChange,
}: PriorityMenuProps) {
  const options = [null, ...choices]
  const { t } = useTranslation('tickets')
  const choose = (value: unknown) => {
    const next = options.find((option) => priorityValue(option) === value)
    if (next !== undefined && priorityValue(next) !== priorityValue(priority)) onChange(next)
  }
  if (!writable || choices.length === 0) return <StaticPriority named={named} priority={priority} />
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('priority.trigger', { priority: priorityName(priority) })}
        render={ticketMenuTrigger(named, metadata)}
      >
        <PriorityIcon priority={priority} />
        {named ? priorityName(priority) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto">
        <DropdownMenuRadioGroup onValueChange={choose} value={priorityValue(priority)}>
          {options.map((option) => (
            <DropdownMenuRadioItem
              closeOnClick
              key={priorityValue(option)}
              value={priorityValue(option)}
            >
              <PriorityIcon priority={option} />
              {option?.label ?? NO_PRIORITY_LABEL}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
