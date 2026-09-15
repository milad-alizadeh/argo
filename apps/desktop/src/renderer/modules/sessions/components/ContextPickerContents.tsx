import { Ban, CheckCircle2, Circle, CircleDotDashed, Folder, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { ComposerTicketContext } from '../state/useComposerStore'
import { TicketProviderIcon } from './TicketProviderIcon'

export type TicketChoice = Omit<ComposerTicketContext, 'id'>

const statusIcon: Record<string, LucideIcon> = {
  Closed: CheckCircle2,
  Done: CheckCircle2,
  'In Progress': CircleDotDashed,
  Open: Circle,
}

function TicketResult({
  onSelect,
  providerLabel,
  ticket,
}: {
  onSelect: (ticket: TicketChoice) => void
  providerLabel: (provider: TicketChoice['provider']) => string
  ticket: TicketChoice
}) {
  const { t } = useTranslation('sessions')
  const StatusIcon = statusIcon[ticket.status] ?? Circle
  return (
    <button
      className="flex w-full items-center gap-(--spacing-shell-item) rounded-lg px-(--spacing-shell-inset) py-(--spacing-shell-item) text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onSelect(ticket)}
      type="button"
    >
      <TicketProviderIcon provider={ticket.provider} />
      <span className="sr-only">{providerLabel(ticket.provider)} </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-(--spacing-shell-tight) type-label">
          <span className="shrink-0 font-mono text-muted-foreground">{ticket.key}</span>
          <span className="truncate">{ticket.title}</span>
        </span>
        <span className={ticket.terminal ? 'text-danger' : 'text-muted-foreground'}>
          <StatusIcon aria-hidden="true" className="size-3.5" />
          <span className="sr-only">
            {ticket.terminal
              ? t('composer.contextPicker.terminal', { status: ticket.status })
              : ticket.status}
          </span>
        </span>
      </span>
      {ticket.blocked ? (
        <span className="flex shrink-0 items-center gap-1 text-danger type-meta">
          <Ban aria-hidden="true" className="size-3.5" />
          <span className="sr-only">{t('composer.contextPicker.blocked')}</span>
        </span>
      ) : null}
    </button>
  )
}

export function ContextPickerContents({
  onAttach,
  onSelectTicket,
  providerLabel,
  tickets,
}: {
  onAttach: () => void
  onSelectTicket: (ticket: TicketChoice) => void
  providerLabel: (provider: TicketChoice['provider']) => string
  tickets: TicketChoice[]
}) {
  const { t } = useTranslation('sessions')
  return (
    <>
      <div className="border-t pt-(--spacing-shell-item)">
        <button
          className="flex w-full items-center gap-(--spacing-shell-item) rounded-lg px-(--spacing-shell-inset) py-(--spacing-shell-item) text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
          onClick={onAttach}
          type="button"
        >
          <Folder aria-hidden="true" className="size-4" />
          <span className="type-label">{t('composer.contextPicker.filesAndFolders')}</span>
        </button>
      </div>
      <div className="mt-(--spacing-shell-item) border-t pt-(--spacing-shell-item)">
        <p className="px-(--spacing-shell-inset) type-meta text-muted-foreground">
          {t('composer.contextPicker.tickets')}
        </p>
        {tickets.map((ticket) => (
          <TicketResult
            key={`${ticket.provider}-${ticket.key}`}
            onSelect={onSelectTicket}
            providerLabel={providerLabel}
            ticket={ticket}
          />
        ))}
      </div>
      <div className="mt-(--spacing-shell-item) border-t pt-(--spacing-shell-item)">
        <button
          aria-disabled="true"
          className="flex w-full cursor-not-allowed items-center gap-(--spacing-shell-item) rounded-lg px-(--spacing-shell-inset) py-(--spacing-shell-item) text-left text-muted-foreground type-label"
          disabled
          type="button"
        >
          {t('composer.contextPicker.goals')}
          <span className="type-meta">{t('composer.contextPicker.comingSoon')}</span>
        </button>
      </div>
    </>
  )
}
