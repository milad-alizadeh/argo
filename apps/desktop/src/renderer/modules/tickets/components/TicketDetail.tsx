import type { ReactNode } from 'react'

import type { Ticket, TicketLink } from '@/core/tickets/contract'
import { Badge } from '../../../components/ui/badge'
import { Empty, EmptyHeader, EmptyTitle } from '../../../components/ui/empty'
import { closedChildren } from '../lib/backlog'

const STATE_LABELS = { open: 'Open', closed: 'Closed' } as const

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="grid gap-(--spacing-shell-tight)">
      <h3 className="type-label text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

function Links({ links }: { links: readonly TicketLink[] }) {
  return (
    <ul className="grid gap-(--spacing-shell-tight)">
      {links.map((link) => (
        <li className="flex items-baseline gap-(--spacing-shell-item) type-body" key={link.number}>
          <span className="shrink-0 font-mono type-meta text-faint">#{link.number}</span>
          <span className="min-w-0 flex-1 truncate">{link.title}</span>
          <span className="shrink-0 type-meta text-muted-foreground">
            {STATE_LABELS[link.state]}
          </span>
        </li>
      ))}
    </ul>
  )
}

function Facts({ ticket }: { ticket: Ticket }) {
  if (ticket.type === null && ticket.labels.length === 0) return null
  return (
    <dl className="flex flex-wrap items-center gap-x-(--spacing-shell-inset) gap-y-(--spacing-shell-tight) type-meta">
      {ticket.type ? (
        <div className="flex gap-(--spacing-shell-icon)">
          <dt className="text-muted-foreground">Type</dt>
          <dd>{ticket.type}</dd>
        </div>
      ) : null}
      {ticket.labels.length > 0 ? (
        <div className="flex flex-wrap items-center gap-(--spacing-shell-icon)">
          <dt className="text-muted-foreground">Labels</dt>
          {ticket.labels.map((label) => (
            <dd key={label.name}>
              <Badge variant="outline">{label.name}</Badge>
            </dd>
          ))}
        </div>
      ) : null}
    </dl>
  )
}

function Dependencies({ blockedBy }: { blockedBy: Ticket['blockedBy'] }) {
  if (blockedBy === null) {
    return (
      <Section title="Blocked by">
        <p className="type-meta text-muted-foreground">
          GitHub gives no dependency information for this Ticket.
        </p>
      </Section>
    )
  }
  if (blockedBy.length === 0) return null
  return (
    <Section title={`Blocked by · ${blockedBy.length}`}>
      <Links links={blockedBy} />
    </Section>
  )
}

export function TicketDetail({ ticket }: { ticket: Ticket | null }) {
  if (ticket === null) {
    return (
      <Empty className="h-full border-0">
        <EmptyHeader>
          <EmptyTitle>Select a Ticket</EmptyTitle>
        </EmptyHeader>
      </Empty>
    )
  }
  const { children } = ticket
  return (
    <article
      aria-label={`Ticket #${ticket.number}`}
      className="grid grid-cols-[minmax(0,1fr)] content-start gap-(--spacing-shell-section) overflow-y-auto px-(--spacing-shell-region) py-(--spacing-shell-section)"
    >
      <header className="grid gap-(--spacing-shell-item)">
        <div className="flex items-baseline gap-(--spacing-shell-item)">
          <span className="font-mono type-meta text-faint">#{ticket.number}</span>
          <h2 className="type-title min-w-0 flex-1 wrap-anywhere">{ticket.title}</h2>
          <Badge variant="secondary">{STATE_LABELS[ticket.state]}</Badge>
        </div>
        <Facts ticket={ticket} />
      </header>
      <p className="type-prose whitespace-pre-wrap wrap-anywhere">
        {ticket.body?.trim() ? ticket.body : 'No description.'}
      </p>
      {children.length > 0 ? (
        <Section title={`Children · ${closedChildren(ticket)} of ${children.length} closed`}>
          <Links links={children} />
        </Section>
      ) : null}
      <Dependencies blockedBy={ticket.blockedBy} />
    </article>
  )
}
