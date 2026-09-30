import { useTranslation } from 'react-i18next'

import type { TicketStatus } from '@/domains/tickets/api/ticket'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/platform/renderer/components/ui/dropdown-menu'
import { ticketMenuTrigger } from './ticket-menu-trigger'
import { StatusIcon, StatusMark } from './ticket-status'

export type StatusMenuProps = {
  status: TicketStatus
  statuses: readonly TicketStatus[]
  noun: string
  // The Detail writes the name beside the icon; a row draws the icon alone.
  named: boolean
  metadata?: boolean
  current?: number
  total?: number
  // False draws the status without the choices, for a Ticket whose Account cannot be called.
  writable?: boolean
  onChange: (status: TicketStatus) => void
}

// A Ticket's status as a menu of every status its provider offers.
export function StatusMenu({
  status,
  statuses,
  noun,
  named,
  metadata = false,
  current,
  total,
  writable = true,
  onChange,
}: StatusMenuProps) {
  const { t } = useTranslation('tickets')
  if (!writable || statuses.length === 0) return <StatusMark named={named} status={status} />
  const choose = (id: unknown) => {
    const next = statuses.find((candidate) => candidate.id === id)
    if (next && next.id !== status.id) onChange(next)
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('status.trigger', { noun, status: status.name })}
        render={ticketMenuTrigger(named, metadata)}
      >
        <StatusIcon current={current} status={status} statuses={statuses} total={total} />
        {named ? status.name : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto">
        <DropdownMenuRadioGroup onValueChange={choose} value={status.id}>
          {statuses.map((option) => (
            <DropdownMenuRadioItem closeOnClick key={option.id} value={option.id}>
              <StatusIcon status={option} statuses={statuses} />
              {option.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
