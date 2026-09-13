// Tickets and Accounts the Tickets stories draw.
import { fn } from 'storybook/test'

import type { AccountSummary } from '@/core/accounts/contract'
import type { Ticket } from '@/core/tickets/contract'
import type { TicketsView } from '../hooks/useTicketsView'
import type { Backlog } from '../lib/backlog'

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
  createdAt: '2026-06-01T09:00:00Z',
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
  createdAt: '2026-06-02T09:00:00Z',
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
  createdAt: '2026-01-15T09:00:00Z',
  labels: [
    { name: 'planning', color: null },
    { name: 'wayfinder', color: null },
    { name: 'needs-triage', color: null },
  ],
  blockedBy: [],
}

export const octocat: AccountSummary = {
  id: 'github:583231',
  provider: 'github',
  login: 'octocat',
  state: 'connected',
  bindings: [],
}

export const backlog = (overrides: Partial<Backlog> = {}): Backlog => ({
  scope: 'octocat/hello-world',
  tickets: [prototype, wayfinder, standalone],
  query: '',
  total: null,
  hasMore: false,
  loadingMore: false,
  searching: false,
  onLoadMore: fn(),
  ...overrides,
})

// Enough Tickets to scroll, numbered below the fixtures so none collides with them.
export const longBacklog = (length: number): Ticket[] =>
  Array.from({ length }, (_, index) => ({
    ...standalone,
    number: 100 + index,
    title: `Backlog Ticket ${index + 1}`,
    labels: [],
  }))

export const ticketsView = (overrides: Partial<Backlog> = {}): TicketsView => ({
  kind: 'tickets',
  projectId: 'storybook-project',
  backlog: backlog(overrides),
})
