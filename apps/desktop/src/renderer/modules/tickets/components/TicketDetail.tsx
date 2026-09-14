import { Ban, CircleCheck, CircleDot, ExternalLink, GitFork } from 'lucide-react'
import type { ReactNode } from 'react'

import type { Provider } from '@/core/accounts/contract'
import type { Ticket, TicketLink, TicketStatus } from '@/core/tickets/contract'
import { Badge } from '../../../components/ui/badge'
import { providerPresentation } from '../../accounts/lib/providers'
import { FeedMarkdown } from '../../sessions/feed/content/FeedMarkdown'
import { closedChildren } from '../lib/backlog'
import { SOURCE_PRESENTATION } from '../lib/sources'
import { StatusMenu } from './StatusMenu'
import { TicketDetailEmpty } from './TicketDetailEmpty'
import { TicketDetailSection } from './TicketDetailSection'
import { TicketLabel } from './TicketLabel'
import { PriorityMark } from './TicketStatus'

const STATES = {
  open: { label: 'Open', Icon: CircleDot, tone: 'text-active' },
  closed: { label: 'Closed', Icon: CircleCheck, tone: 'text-muted-foreground' },
} as const

const stateIcon = 'size-(--size-icon-meta) shrink-0'
const blockedIcon = `${stateIcon} text-danger`

type Navigation = { listed: ReadonlySet<string>; onSelect: (key: string) => void }

const linkRow =
  'flex w-full items-center gap-(--spacing-shell-item) rounded-row px-(--spacing-shell-item) py-(--spacing-shell-icon) text-left'

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
      <TicketDetailSection
        title="Blocked by"
        icon={<Ban aria-hidden="true" className={blockedIcon} />}
      >
        <p className="type-meta text-muted-foreground">
          {SOURCE_PRESENTATION[provider].noDependencies}
        </p>
      </TicketDetailSection>
    )
  }
  if (blockedBy.length === 0) return null
  return (
    <TicketDetailSection
      title={`Blocked by · ${blockedBy.length}`}
      icon={<Ban aria-hidden="true" className={blockedIcon} />}
    >
      <Links links={blockedBy} {...navigation} />
    </TicketDetailSection>
  )
}

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
      aria-label={`Open ${ticket.key} in ${providerPresentation(provider).name}`}
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

export type TicketDetailProps = { ticket: Ticket | null; provider: Provider } & Navigation & Editing

export function TicketDetail(props: TicketDetailProps) {
  const { ticket, provider, statuses, onChangeStatus, ...navigation } = props
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
            title={`Children · ${closedChildren(ticket)} of ${children.length} closed`}
            icon={<GitFork aria-hidden="true" className={stateIcon} />}
          >
            <Links links={children} {...navigation} />
          </TicketDetailSection>
        ) : null}
        <Dependencies blockedBy={ticket.blockedBy} provider={provider} {...navigation} />
      </div>
    </article>
  )
}
