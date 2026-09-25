import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Provider } from '@/domains/accounts/contract/contract'
import type { Ticket, TicketPriority, TicketStatus } from '@/domains/tickets/contract/contract'
import { Badge } from '@/platform/renderer/components/ui/badge'
import { sourcePresentation } from '../lib/sources'
import { PriorityMenu } from '../status/priority-menu'
import { StatusMenu } from '../status/status-menu'
import { TicketLabel } from '../status/ticket-label'

function Property({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center rounded-full border border-border/60 px-(--spacing-shell-item) py-(--spacing-shell-tight) @[52rem]:contents">
      <dt className="sr-only text-muted-foreground @[52rem]:not-sr-only">{name}</dt>
      {/* Every value row is as tall as the status trigger, so the rows keep one rhythm. */}
      <dd className="flex min-h-6 min-w-0 flex-wrap items-center gap-(--spacing-shell-tight)">
        {children}
      </dd>
    </div>
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
  const presentation = sourcePresentation(provider)
  const noun = presentation.statusNoun
  return (
    <dl className="flex min-w-0 flex-wrap items-center gap-(--spacing-shell-item) type-meta @[52rem]:grid @[52rem]:grid-cols-[var(--size-ticket-property)_minmax(0,1fr)] @[52rem]:gap-x-(--spacing-shell-gutter) @[52rem]:gap-y-(--spacing-shell-item)">
      <Property name={noun}>
        <StatusMenu
          named
          noun={noun}
          onChange={onChangeStatus}
          status={ticket.status}
          statuses={statuses}
        />
      </Property>
      {presentation.hasPriority ? (
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
