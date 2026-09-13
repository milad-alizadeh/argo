import { CircleCheck, CircleDot, Ticket as TicketMark } from 'lucide-react'
import type { ReactNode } from 'react'

import './ticket-tokens.css'

import type { Ticket, TicketLink } from '@/core/tickets/contract'
import { Badge } from '../../../components/ui/badge'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../../../components/ui/empty'
import { Separator } from '../../../components/ui/separator'
import { closedChildren } from '../lib/backlog'

const STATES = {
  open: { label: 'Open', Icon: CircleDot, tone: 'text-active' },
  closed: { label: 'Closed', Icon: CircleCheck, tone: 'text-muted-foreground' },
} as const

// The icon repeats the word beside it, so a state is never its colour alone.
function State({ state }: { state: Ticket['state'] }) {
  const { label, Icon, tone } = STATES[state]
  return (
    <span className="flex shrink-0 items-center gap-(--spacing-shell-tight) type-meta text-muted-foreground">
      <Icon aria-hidden="true" className={`size-(--size-icon-meta) ${tone}`} />
      {label}
    </span>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      aria-label={title}
      className="grid grid-cols-[minmax(0,1fr)] gap-(--spacing-shell-item)"
    >
      <h3 className="type-label text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

function Links({ links }: { links: readonly TicketLink[] }) {
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] divide-y divide-border/60 rounded-lg border border-border/60">
      {links.map((link) => (
        <li
          className="flex items-center gap-(--spacing-shell-item) px-(--spacing-shell-gutter) py-(--spacing-shell-item)"
          key={link.number}
        >
          <span className="w-(--size-ticket-number) shrink-0 font-mono type-meta text-faint">
            #{link.number}
          </span>
          <span className="min-w-0 flex-1 truncate type-body">{link.title}</span>
          <State state={link.state} />
        </li>
      ))}
    </ul>
  )
}

function Facts({ ticket }: { ticket: Ticket }) {
  if (ticket.type === null && ticket.labels.length === 0) return null
  return (
    <dl className="flex flex-wrap items-center gap-x-(--spacing-shell-section) gap-y-(--spacing-shell-item) type-meta">
      {ticket.type ? (
        <div className="flex items-center gap-(--spacing-shell-item)">
          <dt className="text-muted-foreground">Type</dt>
          <dd>
            <Badge variant="secondary">{ticket.type}</Badge>
          </dd>
        </div>
      ) : null}
      {ticket.labels.length > 0 ? (
        <div className="flex flex-wrap items-center gap-(--spacing-shell-tight)">
          <dt className="mr-(--spacing-shell-tight) text-muted-foreground">Labels</dt>
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

function NothingSelected() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TicketMark aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>Select a Ticket</EmptyTitle>
        <EmptyDescription>Its description, children and blockers show here.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

export function TicketDetail({ ticket }: { ticket: Ticket | null }) {
  if (ticket === null) return <NothingSelected />
  const { children } = ticket
  const body = ticket.body?.trim()
  return (
    <article aria-label={`Ticket #${ticket.number}`} className="min-h-0 flex-1 overflow-y-auto">
      <div className="grid max-w-3xl grid-cols-[minmax(0,1fr)] content-start gap-(--spacing-shell-section) p-(--spacing-shell-section)">
        <header className="grid grid-cols-[minmax(0,1fr)] gap-(--spacing-shell-gutter)">
          <div className="flex items-center gap-(--spacing-shell-gutter)">
            <span className="font-mono type-meta text-faint">#{ticket.number}</span>
            <State state={ticket.state} />
          </div>
          <h2 className="type-title wrap-anywhere">{ticket.title}</h2>
          <Facts ticket={ticket} />
        </header>
        <Separator />
        <p
          className={`type-prose whitespace-pre-wrap wrap-anywhere ${body ? '' : 'text-muted-foreground'}`}
        >
          {body ? ticket.body : 'No description.'}
        </p>
        {children.length > 0 ? (
          <Section title={`Children · ${closedChildren(ticket)} of ${children.length} closed`}>
            <Links links={children} />
          </Section>
        ) : null}
        <Dependencies blockedBy={ticket.blockedBy} />
      </div>
    </article>
  )
}
