// Tickets and Accounts the Tickets stories draw.
import { fn } from 'storybook/test'

import type { AccountSummary, Provider } from '@/core/accounts/contract'
import type { Ticket, TicketStatus } from '@/core/tickets/contract'
import type { TicketsView } from '../hooks/useTicketsView'
import type { Backlog } from '../lib/backlog'

const link = (key: string, title: string, state: 'open' | 'closed' = 'open') => ({
  key,
  title,
  state,
})

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

const issue = (number: number) => ({
  key: `#${number}`,
  url: `https://github.com/octocat/hello-world/issues/${number}`,
})

export const wayfinder: Ticket = {
  ...issue(607),
  title: 'Wayfinder: the Tickets room, end to end',
  body: 'The Tickets room, end to end.\n\nThe backlog in the deck and the Ticket beside it.',
  state: 'open',
  status: { id: 'open', name: 'Open', category: 'unstarted' },
  priority: null,
  createdAt: '2026-06-01T09:00:00Z',
  labels: [
    { name: 'wayfinder', color: '5319e7' },
    { name: 'prd', color: null },
  ],
  type: 'PRD',
  children: [
    link('#609', 'Prototype the Tickets room'),
    link('#388', 'Ticket read path', 'closed'),
  ],
  blockedBy: [link('#609', 'Prototype the Tickets room'), link('#12', 'An old blocker', 'closed')],
}

export const prototype: Ticket = {
  ...wayfinder,
  ...issue(609),
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
  ...issue(273),
  title: 'The Next-up planner',
  createdAt: '2026-01-15T09:00:00Z',
  labels: [
    { name: 'planning', color: null },
    { name: 'wayfinder', color: null },
    { name: 'needs-triage', color: null },
  ],
  blockedBy: [],
}

// A Linear issue keeps a workflow status and a priority that a GitHub Issue has no word for.
export const engine: Ticket = {
  ...standalone,
  key: 'ENG-12',
  url: 'https://linear.app/analytical/issue/ENG-12',
  title: 'Renew the Linear grant before it lapses',
  status: { id: 'eng-in-review', name: 'In Review', category: 'started' },
  priority: { level: 2, label: 'High' },
  labels: [{ name: 'Engine', color: '5e6ad2' }],
  children: [link('ENG-14', 'Show the expired sign-in')],
  blockedBy: [link('ENG-9', 'Store the refresh token', 'closed')],
}

export const octocat: AccountSummary = {
  id: 'github:583231',
  provider: 'github',
  login: 'octocat',
  workspace: null,
  state: 'connected',
  connections: [],
}

export const ada: AccountSummary = {
  id: 'linear:user-ada',
  provider: 'linear',
  login: 'ada@analytical.dev',
  workspace: 'Analytical',
  state: 'connected',
  connections: [],
}

export const backlog = (overrides: Partial<Backlog> = {}): Backlog => ({
  provider: 'github',
  tickets: [prototype, wayfinder, standalone],
  query: '',
  total: null,
  hasMore: false,
  loadingMore: false,
  loadMoreError: null,
  searching: false,
  onLoadMore: fn(),
  onRetryLoadMore: fn(),
  statuses: STATUSES[overrides.provider ?? 'github'],
  onChangeStatus: fn(),
  ...overrides,
})

// Enough Tickets to scroll, numbered below the fixtures so none collides with them.
export const longBacklog = (length: number): Ticket[] =>
  Array.from({ length }, (_, index) => ({
    ...standalone,
    ...issue(100 + index),
    title: `Backlog Ticket ${index + 1}`,
    labels: [],
  }))

export const ticketsView = (overrides: Partial<Backlog> = {}): TicketsView => ({
  kind: 'tickets',
  projectId: 'storybook-project',
  backlog: backlog(overrides),
})
