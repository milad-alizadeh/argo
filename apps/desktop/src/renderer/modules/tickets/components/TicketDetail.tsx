import { CircleCheck, CircleDot, Ticket as TicketMark } from 'lucide-react'
import type { ReactNode } from 'react'

import type { Provider } from '@/core/accounts/contract'
import type { Ticket, TicketLink } from '@/core/tickets/contract'
import { Badge } from '../../../components/ui/badge'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../../../components/ui/empty'
import { PROVIDER_PRESENTATION } from '../../accounts/lib/providers'
import { FeedMarkdown } from '../../sessions/feed/content/FeedMarkdown'
import { closedChildren } from '../lib/backlog'
import { SOURCE_PRESENTATION } from '../lib/sources'
import { PriorityMark, StatusMark } from './TicketStatus'

const STATES = {
  open: { label: 'Open', Icon: CircleDot, tone: 'text-active' },
  closed: { label: 'Closed', Icon: CircleCheck, tone: 'text-muted-foreground' },
} as const

const stateIcon = 'size-(--size-icon-meta) shrink-0'

// The icon's shape tells open from closed, so a state is never its colour alone.
function State({ state }: { state: Ticket['state'] }) {
  const { label, Icon, tone } = STATES[state]
  return (
    <span className="flex shrink-0 items-center gap-(--spacing-shell-tight) type-meta text-muted-foreground">
      <Icon aria-hidden="true" className={`${stateIcon} ${tone}`} />
      {label}
    </span>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      aria-label={title}
      className="grid grid-cols-[minmax(0,1fr)] gap-(--spacing-shell-tight)"
    >
      <h3 className="type-label text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

// Opens a linked Ticket beside its row; only a Ticket the backlog has read can be opened.
type Navigation = { listed: ReadonlySet<string>; onSelect: (key: string) => void }

const linkRow =
  'flex w-full items-center gap-(--spacing-shell-item) rounded-row px-(--spacing-shell-item) py-(--spacing-shell-icon) text-left'

// A linked Ticket's state is its icon, with the word kept for a screen reader, so the title keeps the width.
function LinkContent({ link }: { link: TicketLink }) {
  const { label, Icon, tone } = STATES[link.state]
  return (
    <>
      <Icon aria-hidden="true" className={`${stateIcon} ${tone}`} />
      <span className="sr-only">{label}</span>
      <span className="min-w-0 flex-1 truncate type-body">{link.title}</span>
      <span className="shrink-0 font-mono type-meta text-faint">{link.key}</span>
    </>
  )
}

function Links({ links, listed, onSelect }: { links: readonly TicketLink[] } & Navigation) {
  return (
    <ul className="-mx-(--spacing-shell-item) grid grid-cols-[minmax(0,1fr)]">
      {links.map((link) => (
        <li key={link.key}>
          {listed.has(link.key) ? (
            <button
              className={`${linkRow} hover:bg-muted`}
              onClick={() => onSelect(link.key)}
              type="button"
            >
              <LinkContent link={link} />
            </button>
          ) : (
            <div className={linkRow}>
              <LinkContent link={link} />
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

function Property({ name, children }: { name: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{name}</dt>
      <dd className="flex min-w-0 flex-wrap items-baseline gap-(--spacing-shell-tight)">
        {children}
      </dd>
    </>
  )
}

function Properties({ ticket }: { ticket: Ticket }) {
  return (
    <dl className="grid grid-cols-[var(--size-ticket-property)_minmax(0,1fr)] items-baseline gap-x-(--spacing-shell-gutter) gap-y-(--spacing-shell-item) type-meta">
      {ticket.status ? (
        <Property name="Status">
          <StatusMark named status={ticket.status} />
        </Property>
      ) : (
        <Property name="State">
          <State state={ticket.state} />
        </Property>
      )}
      {ticket.priority ? (
        <Property name="Priority">
          <PriorityMark priority={ticket.priority} />
        </Property>
      ) : null}
      {ticket.type ? (
        <Property name="Type">
          <Badge variant="secondary">{ticket.type}</Badge>
        </Property>
      ) : null}
      {ticket.labels.length > 0 ? (
        <Property name="Labels">
          {ticket.labels.map((label) => (
            <Badge key={label.name} variant="outline">
              {label.name}
            </Badge>
          ))}
        </Property>
      ) : null}
    </dl>
  )
}

type DependenciesProps = { blockedBy: Ticket['blockedBy']; provider: Provider } & Navigation

function Dependencies({ blockedBy, provider, ...navigation }: DependenciesProps) {
  if (blockedBy === null) {
    return (
      <Section title="Blocked by">
        <p className="type-meta text-muted-foreground">
          {SOURCE_PRESENTATION[provider].noDependencies}
        </p>
      </Section>
    )
  }
  if (blockedBy.length === 0) return null
  return (
    <Section title={`Blocked by · ${blockedBy.length}`}>
      <Links links={blockedBy} {...navigation} />
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

// A provider without a page for the Ticket shows its key as plain text.
function TicketKey({ ticket, provider }: { ticket: Ticket; provider: Provider }) {
  const keyText = 'justify-self-start font-mono type-meta text-faint'
  if (ticket.url === null) return <span className={keyText}>{ticket.key}</span>
  return (
    <a
      aria-label={`Open ${ticket.key} on ${PROVIDER_PRESENTATION[provider].name}`}
      className={`${keyText} hover:text-foreground hover:underline`}
      href={ticket.url}
      rel="noreferrer"
      target="_blank"
    >
      {ticket.key}
    </a>
  )
}

export type TicketDetailProps = { ticket: Ticket | null; provider: Provider } & Navigation

export function TicketDetail({ ticket, provider, ...navigation }: TicketDetailProps) {
  if (ticket === null) return <NothingSelected />
  const { children } = ticket
  const body = ticket.body?.trim()
  return (
    <article aria-label={`Ticket ${ticket.key}`} className="min-h-0 flex-1 overflow-y-auto">
      <div className="grid max-w-2xl grid-cols-[minmax(0,1fr)] content-start gap-(--spacing-shell-section) px-(--spacing-shell-inset) py-(--spacing-shell-section)">
        <header className="grid grid-cols-[minmax(0,1fr)] gap-(--spacing-shell-item)">
          <TicketKey provider={provider} ticket={ticket} />
          <h2 className="ticket-title type-title wrap-anywhere">{ticket.title}</h2>
        </header>
        <Properties ticket={ticket} />
        {body ? (
          <FeedMarkdown text={body} />
        ) : (
          <p className="type-body text-muted-foreground">No description.</p>
        )}
        {children.length > 0 ? (
          <Section title={`Children · ${closedChildren(ticket)} of ${children.length} closed`}>
            <Links links={children} {...navigation} />
          </Section>
        ) : null}
        <Dependencies blockedBy={ticket.blockedBy} provider={provider} {...navigation} />
      </div>
    </article>
  )
}
