// The Tickets example: one account, repository, issue, and status list for stories and tests.
import type { Provider } from '@/domains/accounts/contract/contract'
import type { TicketStatus } from '@/domains/tickets/api/ticket'

export const HELLO_WORLD = 'octocat/hello-world'
export const SECRET_REPOSITORY = 'octocat/secret'
export const ENGINE_REPOSITORY = 'octocat/engine'

const OCTOCAT_ID = 583231
const OCTOCAT_LOGIN = 'octocat'
const HUBOT_ID = 2
const HUBOT_LOGIN = 'hubot'

export type ExampleIssue = {
  number: number
  title: string
  state?: 'open' | 'closed'
  body?: string
  labels?: { name: string; color: string }[]
  type?: string
  children?: number[]
  blockedBy?: number[]
  pullRequest?: boolean
}

const EXAMPLE_ISSUES: readonly ExampleIssue[] = [
  { number: 609, title: 'Prototype the Tickets room' },
  {
    number: 607,
    title: 'Wayfinder: the Tickets room, end to end',
    body: 'The backlog in the deck and the Ticket beside it.',
    labels: [{ name: 'wayfinder', color: '5319e7' }],
    type: 'PRD',
    children: [609, 388],
    blockedBy: [609],
  },
  { number: 388, title: 'Ticket read path', state: 'closed' },
  { number: 273, title: 'The Next-up planner' },
  { number: 700, title: 'A pull request is not a Ticket', pullRequest: true },
]

export function octocatUser(): { id: number; login: string } {
  return { id: OCTOCAT_ID, login: OCTOCAT_LOGIN }
}

export function hubotUser(): { id: number; login: string } {
  return { id: HUBOT_ID, login: HUBOT_LOGIN }
}

export function exampleIssue(number: number): ExampleIssue {
  const issue = EXAMPLE_ISSUES.find((item) => item.number === number)
  if (issue === undefined) throw new Error(`Missing example issue ${number}.`)
  return {
    ...issue,
    ...(issue.labels === undefined ? {} : { labels: issue.labels.map((label) => ({ ...label })) }),
    ...(issue.children === undefined ? {} : { children: issue.children.slice() }),
    ...(issue.blockedBy === undefined ? {} : { blockedBy: issue.blockedBy.slice() }),
  }
}

export function exampleIssues(): ExampleIssue[] {
  return EXAMPLE_ISSUES.map((issue) => exampleIssue(issue.number))
}

function status(id: string, name: string, category: TicketStatus['category']): TicketStatus {
  return { id, name, category }
}

// Literals of GITHUB_STATUSES. Importing that module pulls Node HTTP into Storybook.
export function githubStatuses(): TicketStatus[] {
  return [
    status('open', 'Open', 'unstarted'),
    status('completed', 'Closed as completed', 'completed'),
    status('not_planned', 'Closed as not planned', 'canceled'),
    status('duplicate', 'Closed as duplicate', 'canceled'),
  ]
}

export function linearStatuses(): TicketStatus[] {
  return [
    status('eng-backlog', 'Backlog', 'backlog'),
    status('eng-todo', 'Todo', 'unstarted'),
    status('eng-in-progress', 'In Progress', 'started'),
    status('eng-in-review', 'In Review', 'started'),
    status('eng-done', 'Done', 'completed'),
    status('eng-canceled', 'Canceled', 'canceled'),
  ]
}

export function ticketStatuses(provider: Provider): TicketStatus[] {
  switch (provider) {
    case 'github':
      return githubStatuses()
    case 'linear':
      return linearStatuses()
  }
}
