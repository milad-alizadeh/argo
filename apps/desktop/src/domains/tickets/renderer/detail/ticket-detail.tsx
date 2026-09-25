import { useTranslation } from 'react-i18next'
import type { Provider } from '@/domains/accounts/contract/contract'
import { providerPresentation } from '@/domains/accounts/renderer'
import { FeedMarkdown } from '@/domains/sessions/renderer'
import type { Ticket } from '@/domains/tickets/contract/contract'
import { AppPageHeader } from '@/platform/renderer/app/components/app-shell'
import { PageHeading } from '@/platform/renderer/components/page-heading'
import type { LinkedSession } from '../hooks/use-linked-sessions'
import { TicketDetailEmpty } from './ticket-detail-empty'
import { LinkedSessions } from './ticket-detail-linked-sessions'
import type { Navigation } from './ticket-detail-links'
import { type Editing, Properties } from './ticket-detail-properties'

// Metadata flows below the title until the workspace is wide enough to become a quiet right rail.
const detailMeasure =
  'grid max-w-6xl grid-cols-[minmax(0,1fr)] content-start gap-x-(--spacing-shell-section) gap-y-(--spacing-shell-section) px-[var(--inset-cockpit-content-body,var(--spacing-shell-inset))] pb-(--spacing-shell-section) pt-(--spacing-shell-inset) @3xl:grid-cols-[minmax(0,1fr)_18rem]'

export type TicketDetailProps = {
  ticket: Ticket | null
  provider: Provider
  linkedSessions: readonly LinkedSession[]
  onBack: () => void
  onOpenSession: (id: string) => void
} & Navigation &
  Editing

function TicketDetailPageHeader({ onBack }: Pick<TicketDetailProps, 'onBack'>) {
  const { t } = useTranslation('tickets')
  return (
    <AppPageHeader>
      <PageHeading
        as="a"
        className="no-drag-region"
        href="#/tickets"
        icon="back"
        onClick={(event) => {
          event.preventDefault()
          onBack()
        }}
      >
        {t('detail.back')}
      </PageHeading>
    </AppPageHeader>
  )
}

export function TicketDetail(props: TicketDetailProps) {
  const { t } = useTranslation('tickets')
  const {
    ticket,
    provider,
    statuses,
    onChangeStatus,
    onChangePriority,
    linkedSessions,
    onBack,
    onOpenSession,
    ...navigation
  } = props
  if (ticket === null) return <TicketDetailEmpty />
  const body = ticket.body?.trim()
  return (
    <article
      aria-label={t('detail.articleLabel', { key: ticket.key })}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <TicketDetailPageHeader onBack={onBack} />
      <div
        data-component="TicketDetailScroll"
        className="@container min-h-0 flex-1 overflow-y-auto"
      >
        <div className={detailMeasure}>
          <div className="contents @3xl:col-start-1 @3xl:row-start-1 @3xl:block">
            <header className="order-1 flex min-w-0 flex-col items-start gap-(--spacing-shell-item)">
              <h2
                className="min-w-0 self-start line-clamp-2 type-title wrap-anywhere"
                title={ticket.title}
              >
                {ticket.url === null ? (
                  <>
                    {ticket.key} - {ticket.title}
                  </>
                ) : (
                  <a
                    aria-label={t('detail.openInProvider', {
                      key: ticket.key,
                      provider: providerPresentation(provider).name,
                    })}
                    className="hover:underline"
                    href={ticket.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {ticket.key} - {ticket.title}
                  </a>
                )}
              </h2>
            </header>
            <div className="order-3 grid max-w-2xl grid-cols-[minmax(0,1fr)] content-start gap-(--spacing-shell-section) @3xl:mt-(--spacing-shell-section)">
              {body ? (
                <FeedMarkdown text={body} />
              ) : (
                <p className="type-body text-muted-foreground">{t('detail.noDescription')}</p>
              )}
              <LinkedSessions onOpenSession={onOpenSession} sessions={linkedSessions} />
            </div>
          </div>
          <Properties
            onChangePriority={onChangePriority}
            onChangeStatus={onChangeStatus}
            linkedSessionCount={linkedSessions.length}
            listed={navigation.listed}
            onSelect={navigation.onSelect}
            provider={provider}
            statuses={statuses}
            ticket={ticket}
          />
        </div>
      </div>
    </article>
  )
}
