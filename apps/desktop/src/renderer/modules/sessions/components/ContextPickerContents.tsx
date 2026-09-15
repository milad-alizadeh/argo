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
  selected,
  ticket,
}: {
  onSelect: (ticket: TicketChoice) => void
  providerLabel: (provider: TicketChoice['provider']) => string
  selected: boolean
  ticket: TicketChoice
}) {
  const { t } = useTranslation('sessions')
  const StatusIcon = statusIcon[ticket.status] ?? Circle
  return (
    <button
      data-selected={selected || undefined}
      className={`flex w-full items-center gap-(--spacing-shell-item) rounded-lg px-(--spacing-shell-inset) py-(--spacing-shell-item) text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring ${selected ? 'bg-muted' : ''}`}
      data-context-ticket="true"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onSelect(ticket)}
      type="button"
    >
      <TicketProviderIcon provider={ticket.provider} />
      <span className="sr-only">{providerLabel(ticket.provider)} </span>
      <span className="flex min-w-0 flex-1 items-center gap-(--spacing-shell-tight) type-label">
        <span className="shrink-0 font-mono text-muted-foreground">{ticket.key}</span>
        <span
          className={`flex shrink-0 ${ticket.terminal ? 'text-danger' : 'text-muted-foreground'}`}
        >
          <StatusIcon aria-hidden="true" className="size-3.5" />
          <span className="sr-only">
            {ticket.terminal
              ? t('composer.contextPicker.terminal', { status: ticket.status })
              : ticket.status}
          </span>
        </span>
        <span className="min-w-0 flex-1 truncate">{ticket.title}</span>
        {ticket.blocked ? (
          <span className="flex shrink-0 items-center text-danger">
            <Ban aria-hidden="true" className="size-3.5" />
            <span className="sr-only">{t('composer.contextPicker.blocked')}</span>
          </span>
        ) : null}
      </span>
    </button>
  )
}

export function ContextPickerContents({
  onAttach,
  onSelectTicket,
  providerLabel,
  selectedIndex,
  showDefaultOptions,
  tickets,
}: {
  onAttach: () => void
  onSelectTicket: (ticket: TicketChoice) => void
  providerLabel: (provider: TicketChoice['provider']) => string
  selectedIndex: number
  showDefaultOptions: boolean
  tickets: TicketChoice[]
}) {
  const { t } = useTranslation('sessions')
  return (
    <>
      {showDefaultOptions ? (
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
      ) : null}
      {tickets.length > 0 ? (
        <div
          className={
            showDefaultOptions ? 'mt-(--spacing-shell-item) border-t pt-(--spacing-shell-item)' : ''
          }
        >
          <div className="flex items-center gap-(--spacing-shell-item) px-(--spacing-shell-inset)">
            <span className="size-3.5" />
            <p className="type-meta text-muted-foreground">{t('composer.contextPicker.tickets')}</p>
          </div>
          {tickets.map((ticket, index) => (
            <TicketResult
              key={`${ticket.provider}-${ticket.key}`}
              onSelect={onSelectTicket}
              providerLabel={providerLabel}
              selected={index === selectedIndex}
              ticket={ticket}
            />
          ))}
        </div>
      ) : null}
      {showDefaultOptions ? (
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
      ) : null}
    </>
  )
}
