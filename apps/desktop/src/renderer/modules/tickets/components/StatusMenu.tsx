import type { TicketStatus } from '@/core/tickets/contract'
import { Button } from '../../../components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu'
import type { SourcePresentation } from '../lib/sources'
import { StatusIcon, StatusMark } from './TicketStatus'

export type StatusMenuProps = {
  status: TicketStatus
  statuses: readonly TicketStatus[]
  noun: SourcePresentation['statusNoun']
  // The Detail writes the name beside the icon; a row draws the icon alone.
  named: boolean
  onChange: (status: TicketStatus) => void
}

// A Ticket's status as a menu of every status its provider offers.
export function StatusMenu({ status, statuses, noun, named, onChange }: StatusMenuProps) {
  if (statuses.length === 0) return <StatusMark named={named} status={status} />
  const choose = (id: unknown) => {
    const next = statuses.find((candidate) => candidate.id === id)
    if (next && next.id !== status.id) onChange(next)
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${noun}: ${status.name}`}
        render={
          <Button
            className="relative z-10 shrink-0 type-meta text-muted-foreground"
            size={named ? 'xs' : 'icon-xs'}
            variant="ghost"
          />
        }
      >
        <StatusIcon status={status} />
        {named ? status.name : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto">
        <DropdownMenuRadioGroup onValueChange={choose} value={status.id}>
          {statuses.map((option) => (
            <DropdownMenuRadioItem key={option.id} value={option.id}>
              <StatusIcon status={option} />
              {option.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
