import { useTranslation } from 'react-i18next'

import type { ComposerTicketContext } from '../state/useComposerStore'
import { InlineContext } from './InlineContext'
import { TicketProviderIcon } from './TicketProviderIcon'

export function ComposerTicketContexts({
  onOpenTicket,
  onRemove,
  tickets,
}: {
  onOpenTicket?: (key: string) => void
  onRemove: (id: string) => void
  tickets: ComposerTicketContext[]
}) {
  const { t } = useTranslation('sessions')
  if (tickets.length === 0) return null
  return (
    <section
      aria-label={t('composer.contextPicker.selectedTickets')}
      className="flex flex-wrap gap-(--spacing-shell-tight) px-(--spacing-composer-attachment-gutter) py-(--spacing-shell-tight)"
    >
      {tickets.map((ticket) => (
        <InlineContext
          icon={<TicketProviderIcon provider={ticket.provider} />}
          key={ticket.id}
          label={t('composer.contextPicker.openTicket', { key: ticket.key })}
          onClick={onOpenTicket ? () => onOpenTicket(ticket.key) : undefined}
          onRemove={() => onRemove(ticket.id)}
          removeLabel={t('composer.contextPicker.removeTicket', { key: ticket.key })}
          text={ticket.key}
        />
      ))}
    </section>
  )
}
