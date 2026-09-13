// Linear's GraphQL as the fake answers it: the four documents the cockpit sends, told apart by their
// operation name, and Linear's refusals as a 400 whose error carries a code.
import type { FakeLinearIssue, FakeLinearTeam, FakeLinearUser } from './fake-linear'
import { bodyOf, type FakeLinearState, type Route, reply } from './fake-linear-state'

type Variables = { team?: string; term?: string; first?: number; after?: string | null }
type Answer = (state: FakeLinearState, user: FakeLinearUser, variables: Variables) => unknown

const refusal = (code: string) => ({ errors: [{ message: code, extensions: { code } }] })

const CLOSED = new Set(['completed', 'canceled'])

const visible = (state: FakeLinearState, user: FakeLinearUser) =>
  [...state.teams.values()].filter((team) => team.visibleTo.includes(user.id))

// A cursor is the index of the next node, as Linear's opaque cursors are to the cockpit.
function paged<T>(items: T[], variables: Variables) {
  const start = Number(variables.after ?? 0)
  const end = start + (variables.first ?? 50)
  const more = end < items.length
  return {
    totalCount: items.length,
    pageInfo: { hasNextPage: more, endCursor: more ? String(end) : null },
    nodes: items.slice(start, end),
  }
}

function find(state: FakeLinearState, identifier: string): FakeLinearIssue | undefined {
  for (const team of state.teams.values()) {
    const issue = team.issues.find((candidate) => candidate.identifier === identifier)
    if (issue) return issue
  }
}

const stateOf = (issue: FakeLinearIssue) => ({
  name: issue.status ?? 'Todo',
  type: issue.stateType ?? 'unstarted',
})

function link(state: FakeLinearState, identifier: string) {
  const issue = find(state, identifier)
  return issue ? { identifier, title: issue.title, state: { type: stateOf(issue).type } } : null
}

const PRIORITY_LABELS = ['No priority', 'Urgent', 'High', 'Medium', 'Low']

function issueJSON(state: FakeLinearState, user: FakeLinearUser, issue: FakeLinearIssue) {
  const links = (identifiers: string[] = []) =>
    identifiers.map((identifier) => link(state, identifier)).filter((entry) => entry !== null)
  const priority = issue.priority ?? 0
  return {
    id: `issue-${issue.identifier}`,
    identifier: issue.identifier,
    title: issue.title,
    description: issue.description ?? null,
    url: `${state.origin}/${user.workspace}/issue/${issue.identifier}`,
    createdAt: issue.createdAt ?? '2026-09-01T09:00:00.000Z',
    priority,
    priorityLabel: PRIORITY_LABELS[priority],
    state: stateOf(issue),
    labels: { nodes: issue.labels ?? [] },
    children: { nodes: links(issue.children) },
    inverseRelations: {
      nodes: links(issue.blockedBy).map((blocker) => ({ type: 'blocks', issue: blocker })),
    },
  }
}

function openIssues(state: FakeLinearState, user: FakeLinearUser, variables: Variables) {
  const team: FakeLinearTeam | undefined = visible(state, user).find(
    (candidate) => candidate.id === variables.team,
  )
  return (team?.issues ?? [])
    .filter((issue) => !CLOSED.has(stateOf(issue).type))
    .map((issue) => issueJSON(state, user, issue))
}

const ANSWERS: Record<string, Answer> = {
  Viewer: (_state, user) => ({
    viewer: {
      id: user.id,
      name: user.name,
      email: user.email,
      organization: { name: user.workspace },
    },
  }),
  Teams: (state, user, variables) => ({
    teams: paged(
      visible(state, user).map(({ id, key, name }) => ({ id, key, name })),
      variables,
    ),
  }),
  Backlog: (state, user, variables) => {
    const { pageInfo, nodes } = paged(openIssues(state, user, variables), variables)
    return { issues: { pageInfo, nodes } }
  },
  Search: (state, user, variables) => {
    const term = (variables.term ?? '').toLowerCase()
    const matches = openIssues(state, user, variables).filter((issue) =>
      `${issue.title} ${issue.description ?? ''}`.toLowerCase().includes(term),
    )
    return { searchIssues: paged(matches, variables) }
  },
}

function caller(state: FakeLinearState, header: string | undefined): FakeLinearUser | null {
  const grant = state.access.get((header ?? '').replace(/^Bearer /, ''))
  return grant && grant.expiresAt > Date.now() ? grant.user : null
}

export const answerGraphQL: Route = async (state, request, response) => {
  if (state.outage === 'down') return reply(response, 503, { error: 'unavailable' })
  if (state.outage === 'rate-limited') return reply(response, 400, refusal('RATELIMITED'))
  const user = caller(state, request.headers.authorization)
  if (!user) return reply(response, 400, refusal('AUTHENTICATION_ERROR'))
  const body = JSON.parse(await bodyOf(request)) as { query?: string; variables?: Variables }
  const answer = ANSWERS[/query (\w+)/.exec(body.query ?? '')?.[1] ?? '']
  if (!answer) return reply(response, 400, refusal('GRAPHQL_VALIDATION_FAILED'))
  reply(response, 200, { data: answer(state, user, body.variables ?? {}) })
}
