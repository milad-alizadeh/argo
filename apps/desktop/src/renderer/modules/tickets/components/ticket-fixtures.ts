// Tickets and Accounts the Tickets stories draw.
import { fn } from 'storybook/test'

import type { AccountSummary, Provider } from '@/core/accounts/contract'
import type { ConnectionState, ConnectionSummary, Ticket } from '@/core/tickets/contract'
import type { TicketsView } from '../hooks/useTicketsView'
import type { Backlog } from '../lib/backlog'
import { STATUSES } from './status-fixtures'

const link = (key: string, title: string, state: 'open' | 'closed' = 'open') => ({
  key,
  title,
  state,
})

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
  // The colours milad-alizadeh/argo gives these labels on GitHub.
  labels: [
    { name: 'enhancement', color: 'a2eeef' },
    { name: 'wayfinder', color: '5319e7' },
    { name: 'needs-triage', color: 'fbca04' },
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

const CONNECTION_BY_PROVIDER: Record<Provider, Omit<ConnectionSummary, 'state'>> = {
  github: {
    accountId: octocat.id,
    provider: 'github',
    login: octocat.login,
    scope: 'octocat/hello-world',
    label: 'octocat/hello-world',
  },
  linear: {
    accountId: ada.id,
    provider: 'linear',
    login: ada.login,
    scope: 'team-engine',
    label: 'Engine',
  },
}

// A GitHub repository or Linear team Connection, for whichever Account it reads through.
export function connection<State extends ConnectionState = 'ready'>(
  provider: Provider,
  state?: State,
): ConnectionSummary & { state: State } {
  return { ...CONNECTION_BY_PROVIDER[provider], state: (state ?? 'ready') as State }
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
  selectedKey: null,
  onSelect: fn(),
  onOpenSession: fn(),
})
