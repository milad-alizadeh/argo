import { useTranslation } from 'react-i18next'
import type { Provider } from '@/domains/accounts/contract/contract'
import { providerPresentation } from '@/domains/accounts/renderer/port'
import { FeedMarkdown } from '@/domains/sessions/renderer/port'
import type { Ticket } from '@/domains/tickets/contract/contract'
import { TicketDetailEmpty } from '@/domains/tickets/renderer/detail/ticket-detail-empty'
import { LinkedSessions } from '@/domains/tickets/renderer/detail/ticket-detail-linked-sessions'
import {
  Dependencies,
  Links,
  type Navigation,
  stateIcon,
} from '@/domains/tickets/renderer/detail/ticket-detail-links'
import {
  type Editing,
  Properties,
} from '@/domains/tickets/renderer/detail/ticket-detail-properties'
import { TicketDetailSection } from '@/domains/tickets/renderer/detail/ticket-detail-section'
import type { LinkedSession } from '@/domains/tickets/renderer/hooks/use-linked-sessions'
import { closedChildren } from '@/domains/tickets/renderer/lib/backlog'
import { Icon } from '@/platform/renderer/components/icon'

const keyText = 'font-mono type-meta'

function TicketKey({ ticket, provider }: { ticket: Ticket; provider: Provider }) {
  const { t } = useTranslation('tickets')
  if (ticket.url === null) {
    return (
      <span className={`${keyText} justify-self-start shrink-0 text-muted-foreground`}>
        {ticket.key}
      </span>
    )
  }
  return (
    <a
      aria-label={t('detail.openInProvider', {
        key: ticket.key,
        provider: providerPresentation(provider).name,
      })}
      className={`${keyText} inline-flex items-center gap-(--spacing-shell-tight) justify-self-start text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline`}
      href={ticket.url}
      rel="noreferrer"
      target="_blank"
    >
      {ticket.key}
      <Icon name="open-external" className="size-(--size-icon-meta) shrink-0" />
    </a>
  )
}

// Keeps a readable measure while the rule under the header runs the inspector's full width.
const measure =
  'grid max-w-2xl grid-cols-[minmax(0,1fr)] content-start gap-(--spacing-shell-section) px-(--spacing-shell-inset) py-(--spacing-shell-section)'

export type TicketDetailProps = {
  ticket: Ticket | null
  provider: Provider
  linkedSessions: readonly LinkedSession[]
  onOpenSession: (id: string) => void
} & Navigation &
  Editing

export function TicketDetail(props: TicketDetailProps) {
  const { t } = useTranslation('tickets')
  const {
    ticket,
    provider,
    statuses,
    onChangeStatus,
    onChangePriority,
    linkedSessions,
    onOpenSession,
    ...navigation
  } = props
  if (ticket === null) return <TicketDetailEmpty />
  const { children } = ticket
  const body = ticket.body?.trim()
  return (
    <article
      aria-label={t('detail.articleLabel', { key: ticket.key })}
      className="min-h-0 flex-1 overflow-y-auto"
    >
      <header className="border-b border-border/60">
        <div className={measure}>
          <div className="grid min-w-0 gap-(--spacing-shell-tight)">
            <h2 className="min-w-0 type-title wrap-anywhere">{ticket.title}</h2>
            <TicketKey provider={provider} ticket={ticket} />
          </div>
          <Properties
            onChangePriority={onChangePriority}
            onChangeStatus={onChangeStatus}
            provider={provider}
            statuses={statuses}
            ticket={ticket}
          />
        </div>
      </header>
      <div className={measure}>
        {body ? (
          <FeedMarkdown text={body} />
        ) : (
          <p className="type-body text-muted-foreground">{t('detail.noDescription')}</p>
        )}
        {children.length > 0 ? (
          <TicketDetailSection
            icon={<Icon name="ticket-children" className={stateIcon} />}
            title={t('detail.childrenCount', {
              closed: closedChildren(ticket),
              count: children.length,
            })}
          >
            <Links links={children} {...navigation} />
          </TicketDetailSection>
        ) : null}
        <Dependencies blockedBy={ticket.blockedBy} provider={provider} {...navigation} />
        <LinkedSessions onOpenSession={onOpenSession} sessions={linkedSessions} />
      </div>
    </article>
  )
}
