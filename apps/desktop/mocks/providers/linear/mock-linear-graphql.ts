// Linear's GraphQL as the mock answers it: the documents the cockpit sends, told apart by their
// operation name, and Linear's refusals as a 400 whose error carries a code.
import type { MockLinearIssue, MockLinearTeam, MockLinearUser } from './mock-linear'
import {
  bodyOf,
  type MockConsent,
  type MockLinearState,
  type Route,
  reply,
} from './mock-linear-state'
import { findIssue, issueState, moveIssue, setPriority, teamStates } from './mock-linear-workflow'

type Variables = {
  team?: string
  teamId?: string
  term?: string
  first?: number
  after?: string | null
  key?: string
  id?: string
  state?: string
  priority?: number
}
type Answer = (state: MockLinearState, user: MockLinearUser, variables: Variables) => unknown

const refusal = (code: string) => ({ errors: [{ message: code, extensions: { code } }] })

const CLOSED = new Set(['completed', 'canceled'])

const visible = (state: MockLinearState, user: MockLinearUser) =>
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

const typeOf = (issue: MockLinearIssue) => issue.stateType ?? 'unstarted'

function link(state: MockLinearState, identifier: string) {
  const issue = findIssue(state, identifier)?.issue
  return issue ? { identifier, title: issue.title, state: { type: typeOf(issue) } } : null
}

const PRIORITY_LABELS = ['No priority', 'Urgent', 'High', 'Medium', 'Low']

type Place = { team: MockLinearTeam; user: MockLinearUser }

function issueJSON(state: MockLinearState, { team, user }: Place, issue: MockLinearIssue) {
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
    state: issueState(team, issue),
    labels: { nodes: issue.labels ?? [] },
    children: { nodes: links(issue.children) },
    inverseRelations: {
      nodes: links(issue.blockedBy).map((blocker) => ({ type: 'blocks', issue: blocker })),
    },
  }
}

const teamOf = (state: MockLinearState, user: MockLinearUser, id: string | undefined) =>
  visible(state, user).find((candidate) => candidate.id === id)

function openIssues(state: MockLinearState, user: MockLinearUser, variables: Variables) {
  const team = teamOf(state, user, variables.team)
  if (!team) return []
  return team.issues
    .filter((issue) => !CLOSED.has(typeOf(issue)))
    .map((issue) => issueJSON(state, { team, user }, issue))
}

function workflow(state: MockLinearState, user: MockLinearUser, variables: Variables) {
  const team = teamOf(state, user, variables.teamId)
  return team ? { states: { nodes: teamStates(team) } } : null
}

// An issue out of the caller's sight is one Linear cannot find.
function target(state: MockLinearState, user: MockLinearUser, key: string) {
  const found = findIssue(state, key)
  if (!found?.team.visibleTo.includes(user.id)) return null
  const states = { nodes: teamStates(found.team).map(({ id }) => ({ id })) }
  return { id: `issue-${found.issue.identifier}`, team: { id: found.team.id, states } }
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
    return { issues: { pageInfo, nodes }, team: workflow(state, user, variables) }
  },
  Search: (state, user, variables) => {
    const term = (variables.term ?? '').toLowerCase()
    const matches = openIssues(state, user, variables).filter((issue) =>
      `${issue.title} ${issue.description ?? ''}`.toLowerCase().includes(term),
    )
    return { searchIssues: paged(matches, variables), team: workflow(state, user, variables) }
  },
  Target: (state, user, variables) => ({ issue: target(state, user, variables.key ?? '') }),
  Move: (state, _user, variables) => {
    const moved = moveIssue(state, variables.id ?? '', variables.state ?? '')
    return { issueUpdate: { success: moved !== null, issue: moved ? { state: moved } : null } }
  },
  PriorityTarget: (state, user, variables) => ({ issue: target(state, user, variables.key ?? '') }),
  SetPriority: (state, _user, variables) => {
    const level = variables.priority ?? 0
    const changed = setPriority(state, variables.id ?? '', level)
    return {
      issueUpdate: {
        success: changed !== null,
        issue: changed ? { priority: level, priorityLabel: PRIORITY_LABELS[level] } : null,
      },
    }
  },
}

// Linear refuses a write made with a token granted `read` alone.
const WRITES = new Set(['Move', 'SetPriority'])

function caller(state: MockLinearState, header: string | undefined): MockConsent | null {
  const grant = state.access.get((header ?? '').replace(/^Bearer /, ''))
  return grant && grant.expiresAt > Date.now() ? grant : null
}

export const answerGraphQL: Route = async (state, request, response) => {
  if (state.outage === 'down') return reply(response, 503, { error: 'unavailable' })
  if (state.outage === 'rate-limited') return reply(response, 400, refusal('RATELIMITED'))
  const grant = caller(state, request.headers.authorization)
  if (!grant) return reply(response, 400, refusal('AUTHENTICATION_ERROR'))
  const body = JSON.parse(await bodyOf(request)) as { query?: string; variables?: Variables }
  const operation = /(?:query|mutation) (\w+)/.exec(body.query ?? '')?.[1] ?? ''
  const answer = ANSWERS[operation]
  if (!answer) return reply(response, 400, refusal('GRAPHQL_VALIDATION_FAILED'))
  if (WRITES.has(operation) && !grant.scope.split(' ').includes('write')) {
    return reply(response, 400, refusal('FORBIDDEN'))
  }
  reply(response, 200, { data: answer(state, grant.user, body.variables ?? {}) })
}
