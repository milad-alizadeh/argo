import type { RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { ContextPickerContents, type TicketChoice } from './context-picker-contents'
import { useContextPickerFocus } from './use-context-picker-focus'
import { useContextPickerPosition } from './use-context-picker-position'

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
  anchorRef,
  onAttach,
  onClose,
  onSelectTicket,
  query = '',
  autoFocus = true,
  selectedIndex = 0,
}: {
  anchorRef?: RefObject<HTMLDivElement | null>
  onAttach: () => void
  onClose: () => void
  onSelectTicket: (ticket: TicketChoice) => void
  query?: string
  autoFocus?: boolean
  selectedIndex?: number
}) {
  const { t } = useTranslation('sessions')
  const focus = useContextPickerFocus(onClose, autoFocus)
  useContextPickerPosition(anchorRef, focus.pickerRef)
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
  const picker = (
    <div
      aria-label={t('composer.contextPicker.label')}
      aria-modal="true"
      className={`z-50 mb-(--spacing-shell-item) overflow-y-auto overscroll-contain rounded-xl border bg-popover p-(--spacing-shell-item) shadow-(--shadow-surface) ${anchorRef ? 'fixed max-h-[calc(var(--context-picker-space)-var(--spacing-shell-item)*2)] max-w-[calc(100vw-var(--spacing-shell-item)*2)]' : 'absolute bottom-full left-0 w-full'}`}
      onKeyDown={focus.onKeyDown}
      ref={focus.pickerRef}
      role="dialog"
    >
      <ContextPickerContents
        onAttach={onAttach}
        onSelectTicket={onSelectTicket}
        providerLabel={providerLabel}
        selectedIndex={selectedIndex}
        showDefaultOptions={normalizedQuery === ''}
        tickets={shownTickets}
      />
    </div>
  )
  return anchorRef ? createPortal(picker, document.body) : picker
}
