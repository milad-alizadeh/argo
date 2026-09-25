import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Provider } from '@/domains/accounts/contract/contract'
import type { Ticket, TicketLink, TicketState } from '@/domains/tickets/contract/contract'
import { Icon, type IconName } from '@/platform/renderer/components/icon/icon'
import { Button } from '@/platform/renderer/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '@/platform/renderer/components/ui/popover'
import { closedChildren } from '../lib/backlog'
import { sourcePresentation } from '../lib/sources'

const STATE_ICONS: Record<TicketState, { icon: IconName; tone: string }> = {
  open: { icon: 'ticket-link-open', tone: 'text-active' },
  closed: { icon: 'ticket-link-closed', tone: 'text-muted-foreground' },
}

export const stateIcon = 'size-(--size-icon-meta) shrink-0'
const blockedIcon = `${stateIcon} text-danger`

export type Navigation = { listed: ReadonlySet<string>; onSelect: (key: string) => void }

export const linkRow =
  'flex w-full items-center gap-(--spacing-shell-item) rounded-row px-(--spacing-shell-item) py-(--spacing-shell-icon) text-left'

function LinkContent({ link }: { link: TicketLink }) {
  const { t } = useTranslation('tickets')
  const { icon, tone } = STATE_ICONS[link.state]
  return (
    <>
      <Icon name={icon} className={`${stateIcon} ${tone}`} />
      <span className="sr-only">{t(`detail.state.${link.state}`)}</span>
      <span className="min-w-0 flex-1 truncate type-meta" title={link.title}>
        {link.title}
      </span>
      <span className="shrink-0 font-mono type-meta text-faint">{link.key}</span>
    </>
  )
}

export function Links({ links, listed, onSelect }: { links: readonly TicketLink[] } & Navigation) {
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

function RelationList({
  icon,
  label,
  links,
  navigation,
}: {
  icon: ReactNode
  label: string
  links: readonly TicketLink[]
  navigation: Navigation
}) {
  return (
    <div className="hidden min-w-0 grid-cols-[minmax(0,1fr)] gap-(--spacing-shell-tight) @[46rem]:grid">
      <h4 className="flex items-center gap-(--spacing-shell-tight) type-meta text-muted-foreground">
        {icon}
        {label}
      </h4>
      <Links links={links} {...navigation} />
    </div>
  )
}

function RelationPopover({
  icon,
  label,
  links,
  navigation,
}: {
  icon: ReactNode
  label: string
  links: readonly TicketLink[]
  navigation: Navigation
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            className="rounded-full border-border/60 bg-background type-meta shadow-xs @[46rem]:hidden"
            size="xs"
            variant="outline"
          />
        }
      >
        {icon}
        {label}
      </PopoverTrigger>
      <PopoverContent align="start">
        <PopoverTitle className="text-muted-foreground">{label}</PopoverTitle>
        <Links links={links} {...navigation} />
      </PopoverContent>
    </Popover>
  )
}

export type TicketRelationsProps = {
  ticket: Ticket
  provider: Provider
  linkedSessionCount: number
} & Navigation

export function TicketRelations({
  ticket,
  provider,
  linkedSessionCount,
  ...navigation
}: TicketRelationsProps) {
  const { t } = useTranslation('tickets')
  const childrenLabel = t('detail.childrenCount', {
    closed: closedChildren(ticket),
    count: ticket.children.length,
  })
  const childrenCompact = t('detail.childrenCompact', { count: ticket.children.length })
  const blockers = ticket.blockedBy
  const blockersLabel = t('detail.blockedByCount', { count: blockers?.length ?? 0 })
  const blockersCompact = t('detail.blockedByCompact', { count: blockers?.length ?? 0 })
  return (
    <>
      {ticket.children.length > 0 ? (
        <>
          <RelationPopover
            icon={<Icon name="ticket-children" className={stateIcon} />}
            label={childrenCompact}
            links={ticket.children}
            navigation={navigation}
          />
          <RelationList
            icon={<Icon name="ticket-children" className={stateIcon} />}
            label={childrenLabel}
            links={ticket.children}
            navigation={navigation}
          />
        </>
      ) : null}
      {blockers && blockers.length > 0 ? (
        <>
          <RelationPopover
            icon={<Icon name="blocked" className={blockedIcon} />}
            label={blockersCompact}
            links={blockers}
            navigation={navigation}
          />
          <RelationList
            icon={<Icon name="blocked" className={blockedIcon} />}
            label={blockersLabel}
            links={blockers}
            navigation={navigation}
          />
        </>
      ) : null}
      {blockers === null ? (
        <>
          <span className="rounded-full border border-border/60 bg-background px-(--spacing-shell-item) py-(--spacing-shell-tight) shadow-xs @[46rem]:hidden">
            {t('detail.dependenciesUnavailable')}
          </span>
          <p className="hidden type-meta text-muted-foreground @[46rem]:block">
            {sourcePresentation(provider).noDependencies}
          </p>
        </>
      ) : null}
      <span className="rounded-full border border-border/60 bg-background px-(--spacing-shell-item) py-(--spacing-shell-tight) shadow-xs @[46rem]:hidden">
        {t('detail.sessionsCompact', { count: linkedSessionCount })}
      </span>
      <dl className="hidden grid-cols-[var(--size-ticket-property)_minmax(0,1fr)] gap-x-(--spacing-shell-gutter) @[46rem]:grid">
        <dt className="text-muted-foreground">{t('detail.linkedSessions')}</dt>
        <dd className="tabular-nums">{linkedSessionCount}</dd>
      </dl>
    </>
  )
}
