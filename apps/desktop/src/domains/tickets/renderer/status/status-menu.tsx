import { useTranslation } from 'react-i18next'

import type { TicketStatus } from '@/domains/tickets/contract/contract'
import { Badge } from '@/platform/renderer/components/ui/badge'
import { Button } from '@/platform/renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/platform/renderer/components/ui/dropdown-menu'
import type { SourcePresentation } from '../lib/sources'
import { StatusIcon, StatusMark } from './ticket-status'

export type StatusMenuProps = {
  status: TicketStatus
  statuses: readonly TicketStatus[]
  noun: SourcePresentation['statusNoun']
  // The Detail writes the name beside the icon; a row draws the icon alone.
  named: boolean
  metadata?: boolean
  current?: number
  total?: number
  onChange: (status: TicketStatus) => void
}

// Pulls the named trigger's icon onto the value column outside the compact Badge treatment.
const NAMED_INSET = '-ml-[calc(--spacing(2)+var(--size-border))]'
const namedInset = (named: boolean, metadata: boolean) => {
  if (!named) return ''
  return metadata ? '' : NAMED_INSET
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
  onChange,
}: StatusMenuProps) {
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
          metadata ? (
            <Badge
              className={`relative z-10 @3xl:bg-transparent @3xl:text-muted-foreground ${namedInset(named, metadata)}`}
              render={<button type="button" />}
              size="default"
              variant="secondary"
            />
          ) : (
            <Button
              className={`relative z-10 shrink-0 type-meta text-muted-foreground ${namedInset(named, metadata)}`}
              size={named ? 'xs' : 'icon-xs'}
              variant="ghost"
            />
          )
        }
      >
        <StatusIcon current={current} status={status} statuses={statuses} total={total} />
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
