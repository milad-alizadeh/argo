import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Provider } from '@/domains/accounts/contract/contract'
import { providerPresentation } from '@/domains/accounts/renderer'
import type { Ticket, TicketPriority, TicketStatus } from '@/domains/tickets/contract/contract'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Badge } from '@/platform/renderer/components/ui/badge'
import { sourcePresentation } from '../lib/sources'
import { PriorityMenu } from '../status/priority-menu'
import { StatusMenu } from '../status/status-menu'
import { TicketLabel } from '../status/ticket-label'
import { type Navigation, TicketRelations } from './ticket-detail-links'

const COMPACT_VALUE =
  'inline-flex h-6 items-center rounded-full border border-border/60 bg-background px-(--spacing-shell-item) text-foreground shadow-xs @[46rem]:h-auto @[46rem]:rounded-none @[46rem]:border-transparent @[46rem]:bg-transparent @[46rem]:p-0 @[46rem]:shadow-none'

function Property({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="sr-only text-muted-foreground @[46rem]:not-sr-only @[46rem]:flex @[46rem]:min-h-6 @[46rem]:items-center">
        {name}
      </dt>
      {/* Every value row is as tall as the status trigger, so the rows keep one rhythm. */}
      <dd className="contents min-h-6 min-w-0 flex-wrap items-center gap-(--spacing-shell-tight) @[46rem]:flex">
        {children}
      </dd>
    </div>
  )
}

function MetadataSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="contents min-w-0 @[46rem]:block @[46rem]:space-y-(--spacing-shell-item)">
      <h3 className="sr-only type-meta-heading text-muted-foreground @[46rem]:not-sr-only">
        {title}
      </h3>
      {children}
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

function TicketSource({ ticket, provider }: Pick<PropertiesProps, 'ticket' | 'provider'>) {
  const { t } = useTranslation('tickets')
  if (ticket.url === null) return <span className="font-mono">{ticket.key}</span>
  return (
    <a
      aria-label={t('detail.openInProvider', {
        key: ticket.key,
        provider: providerPresentation(provider).name,
      })}
      className={`inline-flex min-w-0 items-center gap-(--spacing-shell-tight) font-mono underline-offset-2 hover:underline ${COMPACT_VALUE}`}
      href={ticket.url}
      rel="noreferrer"
      target="_blank"
    >
      <span className="truncate">{ticket.key}</span>
      <Icon name="open-external" size="meta" />
    </a>
  )
}

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
  const createdAt = new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(ticket.createdAt))
  return (
    <aside
      aria-label={t('detail.metadata')}
      className="order-2 flex min-w-0 flex-wrap items-center gap-(--spacing-shell-item) type-meta @[46rem]:order-none @[46rem]:col-start-2 @[46rem]:row-start-1 @[46rem]:flex-col @[46rem]:items-stretch @[46rem]:gap-(--spacing-shell-section)"
    >
      <MetadataSection title={t('detail.properties')}>
        <dl className="contents min-w-0 grid-cols-[var(--size-ticket-property)_minmax(0,1fr)] gap-x-(--spacing-shell-gutter) gap-y-(--spacing-shell-item) @[46rem]:grid">
          <Property name={t('detail.ticket')}>
            <TicketSource provider={provider} ticket={ticket} />
          </Property>
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
              <Badge className="type-meta" variant="secondary">
                {ticket.type}
              </Badge>
            </Property>
          ) : null}
          <Property name={t('detail.created')}>
            <time className={`${COMPACT_VALUE} gap-1`} dateTime={ticket.createdAt}>
              <span className="@[46rem]:hidden">{t('detail.created')}</span>
              <span>{createdAt}</span>
            </time>
          </Property>
        </dl>
      </MetadataSection>
      {ticket.labels.length > 0 ? (
        <MetadataSection title={t('detail.labels')}>
          <div className="contents min-w-0 flex-wrap items-center gap-(--spacing-shell-tight) @[46rem]:flex">
            {ticket.labels.map((label) => (
              <TicketLabel key={label.name} label={label} />
            ))}
          </div>
        </MetadataSection>
      ) : null}
      <MetadataSection title={t('detail.relations')}>
        <div className="contents min-w-0 @[46rem]:block @[46rem]:space-y-(--spacing-shell-item)">
          <TicketRelations
            linkedSessionCount={linkedSessionCount}
            listed={listed}
            onSelect={onSelect}
            provider={provider}
            ticket={ticket}
          />
        </div>
      </MetadataSection>
    </aside>
  )
}
