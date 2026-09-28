import type { ProviderPresentation } from '@/providers/presentation'

export const linearPresentation: ProviderPresentation = {
  icon: '/provider-icons/linear.svg',
  newTicketURL: null,
  keyColumn: 'w-(--size-ticket-key-long)',
  statusTerm: 'status',
  priority: true,
}
