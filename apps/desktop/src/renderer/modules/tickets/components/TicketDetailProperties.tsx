import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Provider } from '@/core/accounts/contract'
import type { Ticket, TicketPriority, TicketStatus } from '@/core/tickets/contract'
import { Badge } from '../../../components/ui/badge'
import { sourcePresentation } from '../lib/sources'
import { PriorityMenu } from './PriorityMenu'
import { StatusMenu } from './StatusMenu'
import { TicketLabel } from './TicketLabel'

function Property({ name, children }: { name: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{name}</dt>
      {/* Every value row is as tall as the status trigger, so the rows keep one rhythm. */}
      <dd className="flex min-h-6 min-w-0 flex-wrap items-center gap-(--spacing-shell-tight)">
        {children}
      </dd>
    </>
  )
}

// What the Detail offers to change, and the change.
export type Editing = {
  statuses: readonly TicketStatus[]
  onChangeStatus: (status: TicketStatus) => void
  onChangePriority: (priority: TicketPriority | null) => void
}

export type PropertiesProps = { ticket: Ticket; provider: Provider } & Editing

export function Properties({
  ticket,
  provider,
  statuses,
  onChangeStatus,
  onChangePriority,
}: PropertiesProps) {
  const { t } = useTranslation('tickets')
  const noun = sourcePresentation(provider).statusNoun
  return (
    <dl className="grid grid-cols-[var(--size-ticket-property)_minmax(0,1fr)] items-center gap-x-(--spacing-shell-gutter) gap-y-(--spacing-shell-item) type-meta">
      <Property name={noun}>
        <StatusMenu
          named
          noun={noun}
          onChange={onChangeStatus}
          status={ticket.status}
          statuses={statuses}
        />
      </Property>
      {provider === 'linear' ? (
        <Property name={t('detail.priority')}>
          <PriorityMenu named onChange={onChangePriority} priority={ticket.priority} />
        </Property>
      ) : null}
      {ticket.type ? (
        <Property name={t('detail.type')}>
          <Badge className="type-meta" variant="secondary">
            {ticket.type}
          </Badge>
        </Property>
      ) : null}
      {ticket.labels.length > 0 ? (
        <Property name={t('detail.labels')}>
          {ticket.labels.map((label) => (
            <TicketLabel key={label.name} label={label} />
          ))}
        </Property>
      ) : null}
    </dl>
  )
}
