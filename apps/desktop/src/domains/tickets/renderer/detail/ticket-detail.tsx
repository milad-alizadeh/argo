import { useTranslation } from 'react-i18next'
import type { Provider } from '@/domains/accounts/contract/contract'
import { FeedMarkdown } from '@/domains/sessions/renderer'
import type { Ticket } from '@/domains/tickets/contract/contract'
import { CockpitContentChrome } from '@/platform/renderer/cockpit/components/cockpit-content-chrome'
import { Icon } from '@/platform/renderer/components/icon/icon'
import type { LinkedSession } from '../hooks/use-linked-sessions'
import { closedChildren } from '../lib/backlog'
import { TicketDetailEmpty } from './ticket-detail-empty'
import { LinkedSessions } from './ticket-detail-linked-sessions'
import { Dependencies, Links, type Navigation, stateIcon } from './ticket-detail-links'
import { type Editing, Properties } from './ticket-detail-properties'
import { TicketDetailSection } from './ticket-detail-section'

// The header uses spare width for properties. At narrower measures they wrap under the title.
const headerMeasure =
  'grid max-w-6xl grid-cols-[minmax(0,1fr)] content-start gap-(--spacing-shell-section) px-(--spacing-shell-inset) py-(--spacing-shell-section) @[46rem]:grid-cols-[minmax(0,1fr)_18rem]'
const bodyMeasure =
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
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <CockpitContentChrome />
      <div data-component="TicketDetailScroll" className="min-h-0 flex-1 overflow-y-auto">
        <header className="@container border-b border-border/60">
          <div className={headerMeasure}>
            <h2
              className="min-w-0 self-start line-clamp-2 type-title wrap-anywhere"
              title={ticket.title}
            >
              {ticket.title}
            </h2>
            <Properties
              onChangePriority={onChangePriority}
              onChangeStatus={onChangeStatus}
              provider={provider}
              statuses={statuses}
              ticket={ticket}
            />
          </div>
        </header>
        <div className={bodyMeasure}>
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
      </div>
    </article>
  )
}
