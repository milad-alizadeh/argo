import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Provider } from '@/domains/accounts/contract/contract'
import type { Ticket, TicketLink, TicketState } from '@/domains/tickets/api/ticket'
import { statusToneRecipe } from '@/platform/renderer/components/design-system/tone-recipes'
import { Icon, type IconName } from '@/platform/renderer/components/icon/icon'
import { SectionTitle } from '@/platform/renderer/components/section-title'
import { Badge } from '@/platform/renderer/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '@/platform/renderer/components/ui/popover'
import { providerPresentation } from '@/providers/presentation-registry'
import { closedChildren } from '../lib'

const STATE_ICONS: Record<TicketState, { icon: IconName; tone: string }> = {
  open: { icon: 'ticket-link-open', tone: 'text-status-success' },
  closed: { icon: 'ticket-link-closed', tone: 'text-muted-foreground' },
}

export const stateIcon = 'size-(--size-icon-meta) shrink-0'
const blockedIcon = `${stateIcon} text-status-danger`

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
      <span className="min-w-0 flex-1 truncate type-meta" title={`${link.key} - ${link.title}`}>
        {link.key} - {link.title}
      </span>
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

function RelationList({
  icon,
  label,
  metadata,
  links,
  navigation,
}: {
  icon: IconName
  label: string
  metadata: ReactNode
  links: readonly TicketLink[]
  navigation: Navigation
}) {
  return (
    <div className="hidden min-w-0 grid-cols-[minmax(0,1fr)] gap-(--spacing-shell-item) @3xl:grid">
      <SectionTitle
        as="h4"
        icon={icon}
        iconClassName={icon === 'blocked' ? 'text-status-danger' : undefined}
        metadata={metadata}
        className="text-muted-foreground"
      >
        {label}
      </SectionTitle>
      <Links links={links} {...navigation} />
    </div>
  )
}

function RelationPopover({
  icon,
  label,
  links,
  navigation,
  destructive = false,
}: {
  icon: ReactNode
  label: string
  links: readonly TicketLink[]
  navigation: Navigation
  destructive?: boolean
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          destructive ? (
            <Badge
              className={`@3xl:hidden ${statusToneRecipe.danger}`}
              render={<button type="button" />}
              variant="destructive"
            />
          ) : (
            <Badge className="@3xl:hidden" render={<button type="button" />} variant="outline" />
          )
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
  const childrenProgress = t('detail.childrenProgress', {
    closed: closedChildren(ticket),
    count: ticket.children.length,
  })
  const childrenCompact = t('detail.childrenCompact', { count: ticket.children.length })
  const blockers = ticket.blockedBy
  const blockersCompact = t('detail.blockedByCompact', { count: blockers?.length ?? 0 })
  return (
    <>
      {ticket.children.length > 0 ? (
        <>
          <RelationPopover
            icon={<Icon data-icon="inline-start" name="ticket-children" className={stateIcon} />}
            label={childrenCompact}
            links={ticket.children}
            navigation={navigation}
          />
          <RelationList
            icon="ticket-children"
            label={t('detail.childrenTitle')}
            metadata={childrenProgress}
            links={ticket.children}
            navigation={navigation}
          />
        </>
      ) : null}
      {blockers && blockers.length > 0 ? (
        <>
          <RelationPopover
            icon={<Icon data-icon="inline-start" name="blocked" className={blockedIcon} />}
            label={blockersCompact}
            links={blockers}
            navigation={navigation}
            destructive
          />
          <RelationList
            icon="blocked"
            label={t('detail.blockedByTitle')}
            metadata={blockers.length}
            links={blockers}
            navigation={navigation}
          />
        </>
      ) : null}
      {blockers === null ? (
        <>
          <Badge className="@3xl:hidden" variant="outline">
            {t('detail.dependenciesUnavailable')}
          </Badge>
          <p className="hidden type-meta text-muted-foreground @3xl:block">
            {providerPresentation(provider).noDependencies}
          </p>
        </>
      ) : null}
      <dl className="hidden grid-cols-[var(--size-ticket-property)_minmax(0,1fr)] gap-x-(--spacing-shell-gutter) @3xl:grid">
        <dt className="text-muted-foreground">{t('detail.linkedSessions')}</dt>
        <dd className="tabular-nums">{linkedSessionCount}</dd>
      </dl>
    </>
  )
}
