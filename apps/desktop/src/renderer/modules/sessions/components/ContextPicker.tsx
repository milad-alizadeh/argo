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
  query = '',
  autoFocus = true,
}: {
  onAttach: () => void
  onClose: () => void
  onSelectTicket: (ticket: TicketChoice) => void
  query?: string
  autoFocus?: boolean
}) {
  const { t } = useTranslation('sessions')
  const focus = useContextPickerFocus(onClose, autoFocus)
  const tickets = TICKETS.map(({ statusKey, titleKey, ...ticket }) => ({
    ...ticket,
    status: t(statusKey),
    title: t(titleKey),
  }))
  const providerLabel = (provider: TicketChoice['provider']) =>
    t(`composer.contextPicker.provider.${provider}`)
  const normalizedQuery = query.trim().toLowerCase()
  const shownTickets = tickets.filter((ticket) => {
    if (normalizedQuery === '') return !ticket.terminal
    return `${ticket.key} ${ticket.title} ${ticket.status}`.toLowerCase().includes(normalizedQuery)
  })
  return (
    <div
      aria-label={t('composer.contextPicker.label')}
      aria-modal="true"
      className="absolute bottom-full left-0 z-40 mb-2 w-full rounded-xl border bg-card p-(--spacing-shell-item) shadow-xl"
      onKeyDown={focus.onKeyDown}
      ref={focus.pickerRef}
      role="dialog"
    >
      <ContextPickerContents
        onAttach={onAttach}
        onSelectTicket={onSelectTicket}
        providerLabel={providerLabel}
        tickets={shownTickets}
      />
    </div>
  )
}
