import { CircleCheck, CircleDot, ExternalLink, Ticket as TicketMark } from 'lucide-react'
import type { ReactNode } from 'react'

import type { Provider } from '@/core/accounts/contract'
import type { Ticket, TicketLink, TicketStatus } from '@/core/tickets/contract'
import { Badge } from '../../../components/ui/badge'
import { buttonVariants } from '../../../components/ui/button'
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
import { StatusMenu } from './StatusMenu'
import { TicketLabel } from './TicketLabel'
import { PriorityMark } from './TicketStatus'

const STATES = {
  open: { label: 'Open', Icon: CircleDot, tone: 'text-active' },
  closed: { label: 'Closed', Icon: CircleCheck, tone: 'text-muted-foreground' },
} as const

const stateIcon = 'size-(--size-icon-meta) shrink-0'

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
      {/* Every value row is as tall as the status trigger, so the rows keep one rhythm. */}
      <dd className="flex min-h-6 min-w-0 flex-wrap items-center gap-(--spacing-shell-tight)">
        {children}
      </dd>
    </>
  )
}

// What the Detail offers to change, and the change.
type Editing = {
  statuses: readonly TicketStatus[]
  onChangeStatus: (status: TicketStatus) => void
}

type PropertiesProps = { ticket: Ticket; provider: Provider } & Editing

function Properties({ ticket, provider, statuses, onChangeStatus }: PropertiesProps) {
  const noun = SOURCE_PRESENTATION[provider].statusNoun
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
      {ticket.priority ? (
        <Property name="Priority">
          <PriorityMark priority={ticket.priority} />
        </Property>
      ) : null}
      {ticket.type ? (
        <Property name="Type">
          <Badge className="type-meta" variant="secondary">
            {ticket.type}
          </Badge>
        </Property>
      ) : null}
      {ticket.labels.length > 0 ? (
        <Property name="Labels">
          {ticket.labels.map((label) => (
            <TicketLabel key={label.name} label={label} />
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

const keyText = 'font-mono type-meta'

function TicketKey({ ticket, provider }: { ticket: Ticket; provider: Provider }) {
  if (ticket.url === null) {
    return <span className={`${keyText} shrink-0 text-muted-foreground`}>{ticket.key}</span>
  }
  return (
    <a
      aria-label={`Open ${ticket.key} in ${PROVIDER_PRESENTATION[provider].name}`}
      className={`${buttonVariants({ size: 'xs', variant: 'ghost' })} ${keyText} shrink-0 text-muted-foreground`}
      href={ticket.url}
      rel="noreferrer"
      target="_blank"
    >
      {ticket.key}
      <ExternalLink aria-hidden="true" data-icon="inline-end" />
    </a>
  )
}

// Keeps a readable measure while the rule under the header runs the inspector's full width.
const measure =
  'grid max-w-2xl grid-cols-[minmax(0,1fr)] content-start gap-(--spacing-shell-section) px-(--spacing-shell-inset) py-(--spacing-shell-section)'

export type TicketDetailProps = { ticket: Ticket | null; provider: Provider } & Navigation & Editing

export function TicketDetail(props: TicketDetailProps) {
  const { ticket, provider, statuses, onChangeStatus, ...navigation } = props
  if (ticket === null) return <NothingSelected />
  const { children } = ticket
  const body = ticket.body?.trim()
  return (
    <article aria-label={`Ticket ${ticket.key}`} className="min-h-0 flex-1 overflow-y-auto">
      <header className="border-b border-border/60">
        <div className={measure}>
          <div className="flex min-w-0 items-start gap-(--spacing-shell-item)">
            <TicketKey provider={provider} ticket={ticket} />
            <h2 className="min-w-0 ticket-title type-title wrap-anywhere">{ticket.title}</h2>
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
          <Section title={`Children · ${closedChildren(ticket)} of ${children.length} closed`}>
            <Links links={children} {...navigation} />
          </Section>
        ) : null}
        <Dependencies blockedBy={ticket.blockedBy} provider={provider} {...navigation} />
      </div>
    </article>
  )
}
