// The priority levels Linear offers, in its own words; presentation and the source share them.
import type { TicketPriority } from '@/domains/tickets/contract/ticket'

export const LINEAR_PRIORITY_CHOICES: readonly TicketPriority[] = [
  { level: 1, label: 'Urgent' },
  { level: 2, label: 'High' },
  { level: 3, label: 'Medium' },
  { level: 4, label: 'Low' },
]
