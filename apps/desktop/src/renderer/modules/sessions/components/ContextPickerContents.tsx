import { Ban, File, Folder, GitBranch } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { ComposerTicketContext } from '../state/useComposerStore'

export type TicketChoice = Omit<ComposerTicketContext, 'id'>

function ProviderLogo({ provider }: { provider: TicketChoice['provider'] }) {
  return provider === 'github' ? (
    <GitBranch aria-hidden="true" className="size-4 shrink-0" />
  ) : (
    <span
      aria-hidden="true"
      className="flex size-4 shrink-0 items-center justify-center rounded-sm bg-primary font-bold text-primary-foreground type-meta"
    >
      L
    </span>
  )
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
  return (
    <button
      className="flex w-full items-center gap-(--spacing-shell-item) rounded-lg px-(--spacing-shell-inset) py-(--spacing-shell-item) text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
      onClick={() => onSelect(ticket)}
      type="button"
    >
      <ProviderLogo provider={ticket.provider} />
      <span className="sr-only">{providerLabel(ticket.provider)} </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-(--spacing-shell-tight) type-label">
          <span className="shrink-0 font-mono text-muted-foreground">{ticket.key}</span>
          <span className="truncate">{ticket.title}</span>
        </span>
        <span
          className={ticket.terminal ? 'type-meta text-danger' : 'type-meta text-muted-foreground'}
        >
          {ticket.terminal
            ? t('composer.contextPicker.terminal', { status: ticket.status })
            : ticket.status}
        </span>
      </span>
      {ticket.blocked ? (
        <span className="flex shrink-0 items-center gap-1 text-danger type-meta">
          <Ban aria-hidden="true" className="size-3.5" />
          <span>{t('composer.contextPicker.blocked')}</span>
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
          <File aria-hidden="true" className="size-4" />
          <Folder aria-hidden="true" className="-ml-2 size-4" />
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
