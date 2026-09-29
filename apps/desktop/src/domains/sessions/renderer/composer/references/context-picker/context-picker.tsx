import type { RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { providerPresentation } from '@/providers/presentation-registry'

import { useComposerTickets } from '../use-composer-tickets'
import { ContextPickerContents, type TicketChoice } from './context-picker-contents'
import { useContextPickerFocus } from './use-context-picker-focus'
import { useContextPickerPosition } from './use-context-picker-position'

export function ContextPicker({
  anchorRef,
  onAttach,
  onClose,
  onSelectTicket,
  projectId = null,
  query = '',
  autoFocus = true,
  selectedIndex = 0,
  tickets,
}: {
  anchorRef?: RefObject<HTMLDivElement | null>
  onAttach: () => void
  onClose: () => void
  onSelectTicket: (ticket: TicketChoice) => void
  projectId?: string | null
  query?: string
  autoFocus?: boolean
  selectedIndex?: number
  tickets?: readonly TicketChoice[]
}) {
  const { t } = useTranslation('sessions')
  const focus = useContextPickerFocus(onClose, autoFocus)
  useContextPickerPosition(anchorRef, focus.pickerRef)
  const remote = useComposerTickets(
    projectId,
    query,
    tickets === undefined && typeof projectId === 'string',
  )
  const source = tickets ?? remote
  const providerLabel = (provider: TicketChoice['provider']) => providerPresentation(provider).name
  const normalizedQuery = query.trim().toLowerCase()
  const shownTickets = source.filter((ticket) => {
    if (normalizedQuery === '') return !ticket.terminal
    return `${ticket.key} ${ticket.title} ${ticket.status}`.toLowerCase().includes(normalizedQuery)
  })
  const picker = (
    <div
      aria-label={t('composer.contextPicker.label')}
      aria-modal="true"
      className={`z-50 mb-(--spacing-shell-item) overflow-y-auto overscroll-contain rounded-xl border bg-popover p-(--spacing-shell-item) shadow-(--shadow-surface) ${anchorRef ? 'fixed max-h-[calc(var(--context-picker-space)-var(--spacing-shell-item)*2)] max-w-(--size-context-picker-max-width)' : 'absolute bottom-full left-0 w-full'}`}
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
