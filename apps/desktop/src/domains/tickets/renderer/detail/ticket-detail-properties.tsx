import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Provider } from '@/domains/accounts/contract/contract'
import type { Ticket, TicketPriority, TicketStatus } from '@/domains/tickets/contract/contract'
import { sourcePresentation } from '@/domains/tickets/renderer/lib/sources'
import { PriorityMenu } from '@/domains/tickets/renderer/status/priority-menu'
import { StatusMenu } from '@/domains/tickets/renderer/status/status-menu'
import { TicketLabel } from '@/domains/tickets/renderer/status/ticket-label'
import { Badge } from '@/platform/renderer/components/ui/badge'

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
  const presentation = sourcePresentation(provider)
  const noun = presentation.statusNoun
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
