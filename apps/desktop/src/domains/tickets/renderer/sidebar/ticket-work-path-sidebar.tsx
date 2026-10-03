import { useTranslation } from 'react-i18next'
import { SectionTitle } from '@/platform/renderer/components/section-title'
import type { TicketWorkPath, WorkPathTicket } from './ticket-work-path'

import './ticket-work-path-sidebar.css'

type TicketLinkProps = {
  ticket: WorkPathTicket
  onSelect: (key: string) => void
  prominent?: boolean
  showKey?: boolean
}

function TicketLink({ ticket, onSelect, prominent = false, showKey = true }: TicketLinkProps) {
  return (
    <button
      aria-label={`${ticket.key} ${ticket.title}`}
      className="block w-full min-w-0 text-left wrap-anywhere outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
      onClick={() => onSelect(ticket.key)}
      type="button"
    >
      {showKey ? <span className="type-meta text-muted-foreground">{ticket.key}</span> : null}
      <span
        className={
          prominent
            ? 'mt-(--spacing-shell-tight) block type-body font-medium'
            : 'ml-(--spacing-shell-tight)'
        }
      >
        {ticket.title}
      </span>
    </button>
  )
}

export function TicketWorkPathSidebar({
  path,
  onSelect,
}: {
  path: TicketWorkPath
  onSelect: (key: string) => void
}) {
  const { t } = useTranslation('tickets')
  return (
    <section
      aria-labelledby="ticket-work-path-heading"
      className="min-w-0 px-(--spacing-shell-inset) text-sidebar-foreground"
    >
      <SectionTitle
        id="ticket-work-path-heading"
        className="text-sidebar-foreground"
        metadata={t('sidebar.currentPlan')}
      >
        {t('sidebar.workPath')}
      </SectionTitle>
      <p className="mt-(--spacing-shell-item) type-meta text-muted-foreground">
        {t('sidebar.suggestedSequence')}
      </p>

      <div className="relative mt-(--spacing-shell-item) min-w-0 pl-(--spacing-shell-inset)">
        <span
          aria-hidden="true"
          className="ticket-work-path__rail absolute top-(--spacing-shell-item) bottom-(--spacing-shell-item) w-px bg-border"
        />
        <div className="relative min-w-0 rounded-row bg-sidebar-accent text-sidebar-accent-foreground p-(--spacing-shell-item) [--ticket-work-path-marker-inset:var(--spacing-shell-item)]">
          <span aria-hidden="true" className="ticket-work-path__marker bg-primary" />
          <p className="min-w-0 type-meta wrap-anywhere">
            {t('sidebar.startHere')} · {path.start.key}
          </p>
          <TicketLink onSelect={onSelect} prominent showKey={false} ticket={path.start} />
          <p className="mt-(--spacing-shell-tight) min-w-0 type-meta wrap-anywhere">
            {t('sidebar.startReason', { count: path.unlocks.length })}
          </p>
        </div>

        <div className="relative mt-(--spacing-shell-section) min-w-0 pl-(--spacing-shell-tight)">
          <span
            aria-hidden="true"
            className="ticket-work-path__marker border border-primary bg-sidebar"
          />
          <SectionTitle as="h4">
            {t('sidebar.unlocks', { count: path.unlocks.length })}
          </SectionTitle>
          <ul className="mt-(--spacing-shell-item) min-w-0 space-y-(--spacing-shell-item) type-meta">
            {path.unlocks.map((ticket) => (
              <li className="min-w-0" key={ticket.key}>
                <TicketLink onSelect={onSelect} ticket={ticket} />
              </li>
            ))}
          </ul>
        </div>
      </div>

      {path.readyOutsidePath ? (
        <section className="mt-(--spacing-shell-section) pt-(--spacing-shell-item)">
          <SectionTitle as="h4" className="text-muted-foreground" icon="sparkles">
            {t('sidebar.readyOutsidePath')}
          </SectionTitle>
          <div className="mt-(--spacing-shell-item) type-meta">
            <TicketLink onSelect={onSelect} ticket={path.readyOutsidePath} />
          </div>
        </section>
      ) : null}
    </section>
  )
}
