import { LINEAR_PRIORITY_CHOICES } from '@/providers/linear/priority-choices'
import type { ProviderPresentation } from '@/providers/presentation'

export const linearPresentation: ProviderPresentation = {
  icon: '/provider-icons/linear.svg',
  newTicketURL: null,
  keyColumn: 'w-(--size-ticket-key-long)',
  statusTerm: 'status',
  priorityChoices: LINEAR_PRIORITY_CHOICES,
}
