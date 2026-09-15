import { Ban, CircleCheck, CircleDot } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Provider } from '@/core/accounts/contract'
import type { Ticket, TicketLink, TicketState } from '@/core/tickets/contract'
import { sourcePresentation } from '../lib/sources'
import { TicketDetailSection } from './ticket-detail-section'

const STATE_ICONS: Record<TicketState, { Icon: typeof CircleDot; tone: string }> = {
  open: { Icon: CircleDot, tone: 'text-active' },
  closed: { Icon: CircleCheck, tone: 'text-muted-foreground' },
}

export const stateIcon = 'size-(--size-icon-meta) shrink-0'
const blockedIcon = `${stateIcon} text-danger`

export type Navigation = { listed: ReadonlySet<string>; onSelect: (key: string) => void }

export const linkRow =
  'flex w-full items-center gap-(--spacing-shell-item) rounded-row px-(--spacing-shell-item) py-(--spacing-shell-icon) text-left'

function LinkContent({ link }: { link: TicketLink }) {
  const { t } = useTranslation('tickets')
  const { Icon, tone } = STATE_ICONS[link.state]
  return (
    <>
      <Icon aria-hidden="true" className={`${stateIcon} ${tone}`} />
      <span className="sr-only">{t(`detail.state.${link.state}`)}</span>
      <span className="min-w-0 flex-1 truncate type-body">{link.title}</span>
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

export type DependenciesProps = { blockedBy: Ticket['blockedBy']; provider: Provider } & Navigation

export function Dependencies({ blockedBy, provider, ...navigation }: DependenciesProps) {
  const { t } = useTranslation('tickets')
  if (blockedBy === null) {
    return (
      <TicketDetailSection
        icon={<Ban aria-hidden="true" className={blockedIcon} />}
        title={t('detail.blockedBy')}
      >
        <p className="type-meta text-muted-foreground">
          {sourcePresentation(provider).noDependencies}
        </p>
      </TicketDetailSection>
    )
  }
  if (blockedBy.length === 0) return null
  return (
    <TicketDetailSection
      icon={<Ban aria-hidden="true" className={blockedIcon} />}
      title={t('detail.blockedByCount', { count: blockedBy.length })}
    >
      <Links links={blockedBy} {...navigation} />
    </TicketDetailSection>
  )
}
