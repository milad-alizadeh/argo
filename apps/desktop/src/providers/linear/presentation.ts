import type { ProviderPresentation } from '@/providers/presentation'

export const linearPresentation: ProviderPresentation = {
  icon: '/provider-icons/linear.svg',
  newTicketURL: null,
  keyColumn: 'w-(--size-ticket-key-long)',
  statusTerm: 'status',
  priorityChoices: [
    { level: 1, label: 'Urgent' },
    { level: 2, label: 'High' },
    { level: 3, label: 'Medium' },
    { level: 4, label: 'Low' },
  ],
}
