import { ExternalLink, GitFork } from 'lucide-react'

import type { Provider } from '@/core/accounts/contract'
import type { Ticket } from '@/core/tickets/contract'
import { PROVIDER_PRESENTATION } from '../../accounts/lib/providers'
import { FeedMarkdown } from '../../sessions/feed/content/FeedMarkdown'
import type { LinkedSession } from '../hooks/useLinkedSessions'
import { closedChildren } from '../lib/backlog'
import { TicketDetailEmpty } from './TicketDetailEmpty'
import { LinkedSessions } from './TicketDetailLinkedSessions'
import { Dependencies, Links, type Navigation, stateIcon } from './TicketDetailLinks'
import { type Editing, Properties } from './TicketDetailProperties'
import { TicketDetailSection } from './TicketDetailSection'

const keyText = 'font-mono type-meta'

function TicketKey({ ticket, provider }: { ticket: Ticket; provider: Provider }) {
  if (ticket.url === null) {
    return (
      <span className={`${keyText} justify-self-start shrink-0 text-muted-foreground`}>
        {ticket.key}
      </span>
    )
  }
  return (
    <a
      aria-label={`Open ${ticket.key} in ${PROVIDER_PRESENTATION[provider].name}`}
      className={`${keyText} inline-flex items-center gap-(--spacing-shell-tight) justify-self-start text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline`}
      href={ticket.url}
      rel="noreferrer"
      target="_blank"
    >
      {ticket.key}
      <ExternalLink aria-hidden="true" className="size-(--size-icon-meta) shrink-0" />
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
  const {
    ticket,
    provider,
    statuses,
    onChangeStatus,
    linkedSessions,
    onOpenSession,
    ...navigation
  } = props
  if (ticket === null) return <TicketDetailEmpty />
  const { children } = ticket
  const body = ticket.body?.trim()
  return (
    <article aria-label={`Ticket ${ticket.key}`} className="min-h-0 flex-1 overflow-y-auto">
      <header className="border-b border-border/60">
        <div className={measure}>
          <div className="grid min-w-0 gap-(--spacing-shell-tight)">
            <h2 className="min-w-0 ticket-title type-title wrap-anywhere">{ticket.title}</h2>
            <TicketKey provider={provider} ticket={ticket} />
          </div>
          <Properties
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
          <p className="type-body text-muted-foreground">No description.</p>
        )}
        {children.length > 0 ? (
          <TicketDetailSection
            icon={<GitFork aria-hidden="true" className={stateIcon} />}
            title={`Children · ${closedChildren(ticket)} of ${children.length} closed`}
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
