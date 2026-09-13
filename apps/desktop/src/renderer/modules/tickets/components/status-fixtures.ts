import type { Provider } from '@/core/accounts/contract'
import type { TicketStatus } from '@/core/tickets/contract'

// The statuses each provider offers: GitHub's open and reasons for closing, a Linear team's workflow.
export const STATUSES: Record<Provider, TicketStatus[]> = {
  github: [
    { id: 'open', name: 'Open', category: 'unstarted' },
    { id: 'completed', name: 'Closed as completed', category: 'completed' },
    { id: 'not_planned', name: 'Closed as not planned', category: 'canceled' },
    { id: 'duplicate', name: 'Closed as duplicate', category: 'canceled' },
  ],
  linear: [
    { id: 'eng-backlog', name: 'Backlog', category: 'backlog' },
    { id: 'eng-todo', name: 'Todo', category: 'unstarted' },
    { id: 'eng-in-progress', name: 'In Progress', category: 'started' },
    { id: 'eng-in-review', name: 'In Review', category: 'started' },
    { id: 'eng-done', name: 'Done', category: 'completed' },
    { id: 'eng-canceled', name: 'Canceled', category: 'canceled' },
  ],
}
