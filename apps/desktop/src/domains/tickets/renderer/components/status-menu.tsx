import { useTranslation } from 'react-i18next'

import type { TicketStatus } from '@/domains/tickets/contract/contract'
import { StatusIcon, StatusMark } from '@/domains/tickets/renderer/components/ticket-status'
import type { SourcePresentation } from '@/domains/tickets/renderer/lib/sources'
import { Button } from '@/platform/renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/platform/renderer/components/ui/dropdown-menu'

export type StatusMenuProps = {
  status: TicketStatus
  statuses: readonly TicketStatus[]
  noun: SourcePresentation['statusNoun']
  // The Detail writes the name beside the icon; a row draws the icon alone.
  named: boolean
  onChange: (status: TicketStatus) => void
}

// Pulls the named trigger's icon onto the value column: the xs button's px-2 plus its 1px border.
const NAMED_INSET = '-ml-[calc(--spacing(2)+var(--size-border))]'

// A Ticket's status as a menu of every status its provider offers.
export function StatusMenu({ status, statuses, noun, named, onChange }: StatusMenuProps) {
  const { t } = useTranslation('tickets')
  if (statuses.length === 0) return <StatusMark named={named} status={status} />
  const choose = (id: unknown) => {
    const next = statuses.find((candidate) => candidate.id === id)
    if (next && next.id !== status.id) onChange(next)
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('status.trigger', { noun, status: status.name })}
        render={
          <Button
            className={`relative z-10 shrink-0 type-meta text-muted-foreground ${named ? NAMED_INSET : ''}`}
            size={named ? 'xs' : 'icon-xs'}
            variant="ghost"
          />
        }
      >
        <StatusIcon status={status} statuses={statuses} />
        {named ? status.name : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto">
        <DropdownMenuRadioGroup onValueChange={choose} value={status.id}>
          {statuses.map((option) => (
            <DropdownMenuRadioItem key={option.id} value={option.id}>
              <StatusIcon status={option} statuses={statuses} />
              {option.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
