import { Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ContextPickerContents, type TicketChoice } from './ContextPickerContents'
import { useContextPickerFocus } from './useContextPickerFocus'

type TicketTextKey =
  | 'composer.contextPicker.ticket.sharedPicker'
  | 'composer.contextPicker.ticket.composerSync'
  | 'composer.contextPicker.ticket.refreshToken'
  | 'composer.contextPicker.ticket.ticketsPrototype'
  | 'composer.contextPicker.ticket.open'
  | 'composer.contextPicker.ticket.inProgress'
  | 'composer.contextPicker.ticket.done'
  | 'composer.contextPicker.ticket.closed'
type TicketFixture = Omit<TicketChoice, 'status' | 'title'> & {
  statusKey: TicketTextKey
  titleKey: TicketTextKey
}

const TICKETS: readonly TicketFixture[] = [
  {
    provider: 'github',
    key: '#2150',
    titleKey: 'composer.contextPicker.ticket.sharedPicker',
    statusKey: 'composer.contextPicker.ticket.open',
    terminal: false,
    blocked: false,
  },
  {
    provider: 'linear',
    key: 'ENG-42',
    titleKey: 'composer.contextPicker.ticket.composerSync',
    statusKey: 'composer.contextPicker.ticket.inProgress',
    terminal: false,
    blocked: true,
  },
  {
    provider: 'linear',
    key: 'ENG-9',
    titleKey: 'composer.contextPicker.ticket.refreshToken',
    statusKey: 'composer.contextPicker.ticket.done',
    terminal: true,
    blocked: null,
  },
  {
    provider: 'github',
    key: '#609',
    titleKey: 'composer.contextPicker.ticket.ticketsPrototype',
    statusKey: 'composer.contextPicker.ticket.closed',
    terminal: true,
    blocked: false,
  },
]

export function ContextPicker({
  onAttach,
  onClose,
  onSelectTicket,
}: {
  onAttach: () => void
  onClose: () => void
  onSelectTicket: (ticket: TicketChoice) => void
}) {
  const { t } = useTranslation('sessions')
  const [query, setQuery] = useState('')
  const focus = useContextPickerFocus(onClose)
  const tickets = TICKETS.map(({ statusKey, titleKey, ...ticket }) => ({
    ...ticket,
    status: t(statusKey),
    title: t(titleKey),
  }))
  const shownTickets = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (normalized === '') return tickets.filter((ticket) => !ticket.terminal)
    return tickets.filter(({ key, title }) => `${key} ${title}`.toLowerCase().includes(normalized))
  }, [query, tickets])
  const providerLabel = (provider: TicketChoice['provider']) =>
    t(`composer.contextPicker.provider.${provider}`)
  return (
    <div
      aria-label={t('composer.contextPicker.label')}
      aria-modal="true"
      className="absolute bottom-full left-0 z-40 mb-2 w-full rounded-xl border bg-card p-(--spacing-shell-item) shadow-xl"
      onKeyDown={focus.onKeyDown}
      ref={focus.pickerRef}
      role="dialog"
    >
      <div className="mb-(--spacing-shell-item) flex items-center gap-(--spacing-shell-item)">
        <Search aria-hidden="true" className="size-4 text-muted-foreground" />
        <input
          aria-label={t('composer.contextPicker.search')}
          className="min-w-0 flex-1 bg-transparent type-body outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('composer.contextPicker.searchPlaceholder')}
          ref={focus.searchRef}
          value={query}
        />
        <button
          aria-label={t('composer.contextPicker.close')}
          className="rounded-sm p-1 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
          onClick={onClose}
          type="button"
        >
          <X className="size-4" />
        </button>
      </div>
      <ContextPickerContents
        onAttach={onAttach}
        onSelectTicket={onSelectTicket}
        providerLabel={providerLabel}
        tickets={shownTickets}
      />
    </div>
  )
}
