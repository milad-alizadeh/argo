import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Provider } from '@/domains/accounts/contract/contract'
import type { Ticket, TicketPriority, TicketStatus } from '@/domains/tickets/contract/contract'
import { Badge } from '@/platform/renderer/components/ui/badge'
import { sourcePresentation } from '../lib/sources'
import { PriorityMenu } from '../status/priority-menu'
import { StatusMenu } from '../status/status-menu'
import { TicketLabel } from '../status/ticket-label'
import { type Navigation, TicketRelations } from './ticket-detail-links'

const COMPACT_VALUE =
  'inline-flex h-5 items-center rounded-full bg-secondary px-(--spacing-shell-item) text-foreground shadow-xs @3xl:h-auto @3xl:rounded-none @3xl:bg-transparent @3xl:p-0 @3xl:shadow-none'

function Property({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="sr-only text-muted-foreground @3xl:not-sr-only @3xl:flex @3xl:min-h-6 @3xl:items-center">
        {name}
      </dt>
      {/* Every value row is as tall as the status trigger, so the rows keep one rhythm. */}
      <dd className="contents min-h-6 min-w-0 flex-wrap items-center gap-(--spacing-shell-tight) @3xl:flex">
        {children}
      </dd>
    </div>
  )
}

function MetadataSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="contents min-w-0 @3xl:flex @3xl:flex-col @3xl:gap-(--spacing-shell-item)">
      <h3 className="sr-only type-meta-heading text-muted-foreground @3xl:not-sr-only">{title}</h3>
      <div className="contents @3xl:flex @3xl:flex-col @3xl:items-stretch">{children}</div>
    </section>
  )
}

// What the Detail offers to change, and the change.
export type Editing = {
  statuses: readonly TicketStatus[]
  onChangeStatus: (status: TicketStatus) => void
  onChangePriority: (priority: TicketPriority | null) => void
}

export type PropertiesProps = {
  ticket: Ticket
  provider: Provider
  linkedSessionCount: number
} & Editing &
  Navigation

export function Properties({
  ticket,
  provider,
  linkedSessionCount,
  listed,
  onSelect,
  statuses,
  onChangeStatus,
  onChangePriority,
}: PropertiesProps) {
  const { t } = useTranslation('tickets')
  const presentation = sourcePresentation(provider)
  const noun = presentation.statusNoun
  const stateNoun = t('status.noun.state')
  return (
    <aside
      aria-label={t('detail.metadata')}
      className="order-2 flex min-w-0 flex-wrap items-center gap-(--spacing-shell-item) type-meta @3xl:order-none @3xl:col-start-2 @3xl:row-start-1 @3xl:flex-col @3xl:items-stretch @3xl:gap-(--spacing-shell-section)"
    >
      <MetadataSection title={t('detail.properties')}>
        <dl className="contents min-w-0 grid-cols-[var(--size-ticket-property)_minmax(0,1fr)] gap-x-(--spacing-shell-gutter) gap-y-(--spacing-shell-item) @3xl:grid">
          <Property name={noun}>
            <StatusMenu
              named
              metadata
              noun={noun}
              onChange={onChangeStatus}
              status={ticket.status}
              statuses={statuses}
            />
          </Property>
          {noun === stateNoun ? null : (
            <Property name={stateNoun}>
              <span className={COMPACT_VALUE}>{t(`detail.state.${ticket.state}`)}</span>
            </Property>
          )}
          {presentation.hasPriority ? (
            <Property name={t('detail.priority')}>
              <PriorityMenu named metadata onChange={onChangePriority} priority={ticket.priority} />
            </Property>
          ) : null}
          {ticket.type ? (
            <Property name={t('detail.type')}>
              <Badge variant="secondary">{ticket.type}</Badge>
            </Property>
          ) : null}
        </dl>
      </MetadataSection>
      {ticket.labels.length > 0 ? (
        <MetadataSection title={t('detail.labels')}>
          <div className="contents min-w-0 flex-wrap items-center gap-(--spacing-shell-tight) @3xl:flex">
            {ticket.labels.map((label) => (
              <TicketLabel key={label.name} label={label} />
            ))}
          </div>
        </MetadataSection>
      ) : null}
      <TicketRelations
        linkedSessionCount={linkedSessionCount}
        listed={listed}
        onSelect={onSelect}
        provider={provider}
        ticket={ticket}
      />
    </aside>
  )
}
