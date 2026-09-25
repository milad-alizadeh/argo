import { useTranslation } from 'react-i18next'
import { Icon } from '@/platform/renderer/components/icon/icon'
import type { TicketWorkPath, WorkPathTicket } from './ticket-work-path'

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
      className="block w-full min-w-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
      onClick={() => onSelect(ticket.key)}
      type="button"
    >
      {showKey ? <span className="type-meta text-faint">{ticket.key}</span> : null}
      <span
        className={
          prominent
            ? 'mt-(--spacing-shell-tight) line-clamp-2 block type-body font-medium text-foreground'
            : 'ml-(--spacing-shell-tight) text-foreground'
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
    <section aria-labelledby="ticket-work-path-heading" className="px-(--spacing-shell-inset)">
      <div className="flex items-baseline justify-between gap-(--spacing-shell-item)">
        <h3 id="ticket-work-path-heading" className="type-meta-heading text-foreground">
          {t('sidebar.workPath')}
        </h3>
        <span className="type-meta text-faint">{t('sidebar.currentPlan')}</span>
      </div>
      <p className="mt-(--spacing-shell-tight) type-meta text-muted-foreground">
        {t('sidebar.suggestedSequence')}
      </p>

      <div className="relative mt-(--spacing-shell-item) pl-(--spacing-shell-inset)">
        <span
          aria-hidden="true"
          className="absolute top-(--spacing-shell-item) bottom-(--spacing-shell-item) [left:calc(var(--size-icon-meta)/2)] w-px bg-border"
        />
        <div className="relative rounded-row bg-muted/70 p-(--spacing-shell-item)">
          <span
            aria-hidden="true"
            className="absolute top-(--spacing-shell-item) -left-(--spacing-shell-inset) size-(--size-icon-meta) rounded-full bg-primary"
          />
          <p className="type-meta text-faint">
            {t('sidebar.startHere')} · {path.start.key}
          </p>
          <TicketLink onSelect={onSelect} prominent showKey={false} ticket={path.start} />
          <p className="mt-(--spacing-shell-tight) type-meta text-muted-foreground">
            {t('sidebar.startReason', { count: path.unlocks.length })}
          </p>
        </div>

        <div className="relative mt-(--spacing-shell-section) pl-(--spacing-shell-tight)">
          <span
            aria-hidden="true"
            className="absolute top-1 -left-(--spacing-shell-inset) size-(--size-icon-meta) rounded-full border-2 border-primary bg-sidebar"
          />
          <h4 className="type-meta-heading">
            {t('sidebar.unlocks', { count: path.unlocks.length })}
          </h4>
          <ul className="mt-(--spacing-shell-item) space-y-(--spacing-shell-item) type-meta">
            {path.unlocks.map((ticket) => (
              <li key={ticket.key}>
                <TicketLink onSelect={onSelect} ticket={ticket} />
              </li>
            ))}
          </ul>
        </div>
      </div>

      {path.readyOutsidePath ? (
        <div className="mt-(--spacing-shell-section) border-t border-border/60 pt-(--spacing-shell-item)">
          <div className="flex items-center gap-(--spacing-shell-tight) type-meta text-muted-foreground">
            <Icon name="sparkles" size="meta" />
            <span>{t('sidebar.readyOutsidePath')}</span>
          </div>
          <div className="mt-(--spacing-shell-tight) type-meta">
            <TicketLink onSelect={onSelect} ticket={path.readyOutsidePath} />
          </div>
        </div>
      ) : null}
    </section>
  )
}
