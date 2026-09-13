// Tickets and Accounts the Tickets stories draw.
import { fn } from 'storybook/test'

import type { AccountSummary } from '@/core/accounts/contract'
import type { Ticket } from '@/core/tickets/contract'
import type { TicketsView } from './TicketsRoom'

const link = (number: number, title: string, state: 'open' | 'closed' = 'open') => ({
  number,
  title,
  state,
})

export const wayfinder: Ticket = {
  number: 607,
  title: 'Wayfinder: the Tickets room, end to end',
  body: 'The Tickets room, end to end.\n\nThe backlog in the deck and the Ticket beside it.',
  state: 'open',
  stateReason: null,
  labels: [
    { name: 'wayfinder', color: '5319e7' },
    { name: 'prd', color: null },
  ],
  type: 'PRD',
  children: [link(609, 'Prototype the Tickets room'), link(388, 'Ticket read path', 'closed')],
  blockedBy: [link(609, 'Prototype the Tickets room'), link(12, 'An old blocker', 'closed')],
}

export const prototype: Ticket = {
  ...wayfinder,
  number: 609,
  title: 'Prototype the Tickets room',
  body: null,
  labels: [],
  type: null,
  children: [],
  blockedBy: null,
}

export const standalone: Ticket = {
  ...prototype,
  number: 273,
  title: 'The Next-up planner',
  blockedBy: [],
}

export const octocat: AccountSummary = {
  id: 'github:583231',
  provider: 'github',
  login: 'octocat',
  state: 'connected',
  bindings: [],
}

export const ticketsView: TicketsView = {
  kind: 'tickets',
  projectId: 'storybook-project',
  scope: 'octocat/hello-world',
  tickets: [prototype, wayfinder, standalone],
  onUnbind: fn(),
}
