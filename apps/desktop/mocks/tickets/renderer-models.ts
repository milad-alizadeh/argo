// Renderer models for the Tickets example. Each call returns a new object.
import type { AccountSummary, Provider } from '@/domains/accounts/contract/contract'
import type { Ticket, TicketPriority } from '@/domains/tickets/api/ticket'
import type { SelectedTicket } from '@/domains/tickets/renderer/detail/ticket-deck'
import type { ConnectionSummary } from '@/domains/tickets/renderer/hooks/ticket-reply'
import type { TicketsView } from '@/domains/tickets/renderer/hooks/use-tickets-view'
import type { Backlog } from '@/domains/tickets/renderer/lib/backlog'
import {
  exampleIssue,
  githubStatuses,
  HELLO_WORLD,
  octocatUser,
  ticketStatuses,
} from '@/mocks/tickets/scenario'

type ConnectionState = ConnectionSummary['state']

const link = (key: string, title: string, state: 'open' | 'closed' = 'open') => ({
  key,
  title,
  state,
})

function issueLink(number: number) {
  const issue = exampleIssue(number)
  return {
    key: `#${issue.number}`,
    url: `https://github.com/${HELLO_WORLD}/issues/${issue.number}`,
    title: issue.title,
  }
}

function openStatus(): Ticket['status'] {
  const open = githubStatuses().find((item) => item.id === 'open')
  if (open === undefined) throw new Error('GitHub example statuses need an open state.')
  return open
}

export function wayfinder(): Ticket {
  const issue = issueLink(607)
  return {
    key: issue.key,
    url: issue.url,
    title: issue.title,
    body: 'The Tickets room, end to end.\n\nThe backlog in the deck and the Ticket beside it.',
    state: 'open',
    status: openStatus(),
    priority: null,
    createdAt: '2026-06-01T09:00:00Z',
    labels: [
      { name: 'wayfinder', color: '5319e7' },
      { name: 'prd', color: null },
    ],
    type: 'PRD',
    children: [
      link(issueLink(609).key, issueLink(609).title),
      link(issueLink(388).key, issueLink(388).title, 'closed'),
      link('#610', 'Refine the Tickets room'),
    ],
    blockedBy: [
      link(issueLink(609).key, issueLink(609).title),
      link('#12', 'An old blocker', 'closed'),
    ],
  }
}

export function prototype(): Ticket {
  const issue = issueLink(609)
  const base = wayfinder()
  return {
    ...base,
    status: { ...base.status },
    key: issue.key,
    url: issue.url,
    title: issue.title,
    createdAt: '2026-06-02T09:00:00Z',
    body: null,
    labels: [],
    type: null,
    children: [],
    blockedBy: null,
  }
}

export function standalone(): Ticket {
  const issue = issueLink(273)
  const base = prototype()
  return {
    ...base,
    status: { ...base.status },
    key: issue.key,
    url: issue.url,
    title: issue.title,
    createdAt: '2026-01-15T09:00:00Z',
    // The colours milad-alizadeh/argo gives these labels on GitHub.
    labels: [
      { name: 'enhancement', color: 'a2eeef' },
      { name: 'wayfinder', color: '5319e7' },
      { name: 'needs-triage', color: 'fbca04' },
    ],
    blockedBy: [],
  }
}

// What Linear's `issuePriorityValues` answers, without its "No priority" row.
export function linearPriorities(): TicketPriority[] {
  return [
    { level: 1, label: 'Urgent' },
    { level: 2, label: 'High' },
    { level: 3, label: 'Medium' },
    { level: 4, label: 'Low' },
  ]
}

// A Linear issue keeps a workflow status and a priority that a GitHub Issue has no word for.
export function engine(): Ticket {
  const base = standalone()
  const review = ticketStatuses('linear').find((item) => item.id === 'eng-in-review')
  if (review === undefined) throw new Error('Linear example statuses need In Review.')
  return {
    ...base,
    key: 'ENG-12',
    url: 'https://linear.app/analytical/issue/ENG-12',
    title: 'Renew the Linear grant before it lapses',
    status: review,
    priority: { level: 2, label: 'High' },
    labels: [{ name: 'Engine', color: '5e6ad2' }],
    children: [link('ENG-14', 'Show the expired sign-in')],
    blockedBy: [link('ENG-9', 'Store the refresh token', 'closed')],
  }
}

export function readPath(): Ticket {
  const issue = issueLink(388)
  const base = prototype()
  const completed = githubStatuses().find((item) => item.id === 'completed')
  if (completed === undefined) throw new Error('GitHub example statuses need a completed state.')
  return {
    ...base,
    key: issue.key,
    url: issue.url,
    title: issue.title,
    body: 'Read one Ticket by its ID.',
    state: 'closed',
    status: completed,
  }
}

export function octocat(): AccountSummary {
  const user = octocatUser()
  return {
    id: `github:${user.id}`,
    provider: 'github',
    login: user.login,
    workspace: null,
    state: 'connected',
    connections: [],
  }
}

export function ada(): AccountSummary {
  return {
    id: 'linear:user-ada',
    provider: 'linear',
    login: 'ada@analytical.dev',
    workspace: 'Analytical',
    state: 'connected',
    connections: [],
  }
}

export function connection<State extends ConnectionState = 'ready'>(
  provider: Provider,
  state?: State,
): ConnectionSummary & { state: State } {
  const account = provider === 'github' ? octocat() : ada()
  const scope =
    provider === 'github'
      ? { scope: HELLO_WORLD, label: HELLO_WORLD }
      : { scope: 'team-engine', label: 'Engine' }
  return {
    accountId: account.id,
    provider,
    login: account.login,
    ...scope,
    state: (state ?? 'ready') as State,
  }
}

const doNothing = () => {}

export function backlog(overrides: Partial<Backlog> = {}): Backlog {
  const provider = overrides.provider ?? 'github'
  return {
    provider,
    tickets: [prototype(), wayfinder(), standalone()],
    query: '',
    total: null,
    hasMore: false,
    loadingMore: false,
    loadMoreError: null,
    searching: false,
    partial: false,
    writable: true,
    priorityChoices: [],
    onLoadMore: doNothing,
    onRetryLoadMore: doNothing,
    sync: { refreshing: false, problem: null },
    statuses: ticketStatuses(provider),
    onChangeStatus: doNothing,
    onChangePriority: doNothing,
    ...overrides,
  }
}

// Enough Tickets to scroll, numbered below the fixtures so none collides with them.
export function longBacklog(length: number): Ticket[] {
  return Array.from({ length }, (_, index) => ({
    ...standalone(),
    labels: [],
    key: `#${100 + index}`,
    url: `https://github.com/${HELLO_WORLD}/issues/${100 + index}`,
    title: `Backlog Ticket ${index + 1}`,
  }))
}

export function noDetail(): SelectedTicket {
  return { ticket: null, statuses: [], reading: false, problem: null }
}

export function ticketsView(
  overrides: Partial<Backlog> = {},
): Extract<TicketsView, { kind: 'tickets' }> {
  return {
    kind: 'tickets',
    projectId: 'storybook-project',
    backlog: backlog(overrides),
    selectedKey: null,
    detail: noDetail(),
    now: new Date('2026-09-25T12:00:00Z').getTime(),
    onBack: doNothing,
    onSelect: doNothing,
    onOpenSession: doNothing,
  }
}
