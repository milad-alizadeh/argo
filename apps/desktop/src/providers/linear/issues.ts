// The Ticket port filled by Linear issues: one team's open Tickets with their children and blockers
// (CONTEXT.md L1 · Ticket). Linear owns every field; nothing here is kept after the read.
import { isRecord } from '../../boundary'
import { TICKET_PAGE_SIZE } from '../../core/tickets/contract'
import {
  closureOf,
  labelColor,
  PRIORITY_LEVELS,
  type Ticket,
  type TicketLabel,
  type TicketLink,
  type TicketPriority,
  type TicketState,
  type TicketStatus,
} from '../../core/tickets/ticket'
import type { LinearEndpoints } from './endpoints'
import { failed, type LinearRead, query } from './http'
import { categoryOf, statusOf, TEAM_STATES, teamStatuses } from './statuses'

// Linear serves children and relations as connections of their own; a Ticket with more than this
// many draws the first ones.
const EDGE_LIMIT = 50

const LINK = 'identifier title state { type }'
const FIELDS = `id identifier title description url createdAt priority priorityLabel
  state { id name type }
  labels(first: ${EDGE_LIMIT}) { nodes { name color } }
  children(first: ${EDGE_LIMIT}) { nodes { ${LINK} } }
  inverseRelations(first: ${EDGE_LIMIT}) { nodes { type issue { ${LINK} } } }`

// The closure every provider shares; Linear's own state word is drawn beside it.
const OPEN_FILTER =
  '{ team: { id: { eq: $team } }, state: { type: { nin: ["completed", "canceled"] } } }'

const BACKLOG = `query Backlog($team: ID!, $teamId: String!, $first: Int!, $after: String) {
  issues(first: $first, after: $after, filter: ${OPEN_FILTER}) {
    pageInfo { hasNextPage endCursor } nodes { ${FIELDS} }
  }
  ${TEAM_STATES}
}`

const SEARCH = `query Search($team: ID!, $teamId: String!, $term: String!, $first: Int!, $after: String) {
  searchIssues(term: $term, first: $first, after: $after, filter: ${OPEN_FILTER}) {
    totalCount pageInfo { hasNextPage endCursor } nodes { ${FIELDS} }
  }
  ${TEAM_STATES}
}`

const stateOf = (value: unknown): TicketState | null => {
  const category = categoryOf(value)
  return category ? closureOf(category) : null
}

const nodes = (connection: unknown): unknown[] =>
  isRecord(connection) && Array.isArray(connection.nodes) ? connection.nodes : []

function link(value: unknown): TicketLink | null {
  if (!isRecord(value) || typeof value.identifier !== 'string') return null
  const state = stateOf(value.state)
  if (!state || typeof value.title !== 'string' || value.identifier === '') return null
  return { key: value.identifier, title: value.title, state }
}

// Linear's priority 0 is "No priority", which is no priority rather than a lowest one.
export function priorityOf(value: unknown, label: unknown): TicketPriority | null {
  const level = PRIORITY_LEVELS.find((candidate) => candidate === value)
  return level && typeof label === 'string' && label !== '' ? { level, label } : null
}

function label(value: unknown): TicketLabel | null {
  if (!isRecord(value) || typeof value.name !== 'string') return null
  return { name: value.name, color: labelColor(value.color) }
}

// A relation of type `blocks` on the inverse side names the issue that blocks this one.
const blockers = (relations: unknown): TicketLink[] =>
  nodes(relations)
    .flatMap((relation) =>
      isRecord(relation) && relation.type === 'blocks' ? [link(relation.issue)] : [],
    )
    .filter((entry) => entry !== null)

// Only a link on Linear's own web host is kept: it is opened in the person's browser.
function pageURL(endpoints: LinearEndpoints, value: unknown): string | null {
  if (typeof value !== 'string' || !URL.canParse(value)) return null
  return new URL(value).origin === endpoints.web ? value : null
}

function ticket(endpoints: LinearEndpoints, value: unknown): Ticket | null {
  const own = link(value)
  const status = isRecord(value) ? statusOf(value.state) : null
  if (!(own && status) || !isRecord(value)) return null
  const { createdAt, description, priority, priorityLabel } = value
  if (typeof createdAt !== 'string' || Number.isNaN(Date.parse(createdAt))) return null
  const prose = typeof description === 'string' ? description.trim() : ''
  return {
    ...own,
    url: pageURL(endpoints, value.url),
    body: prose === '' ? null : prose,
    status,
    priority: priorityOf(priority, priorityLabel),
    createdAt,
    labels: nodes(value.labels)
      .map(label)
      .filter((entry) => entry !== null),
    type: null,
    children: nodes(value.children)
      .map(link)
      .filter((entry) => entry !== null),
    blockedBy: blockers(value.inverseRelations),
  }
}

export type TicketPageRequest = { scope: string; query: string; cursor: string | null }
export type TicketPage = {
  tickets: Ticket[]
  statuses: TicketStatus[]
  nextCursor: string | null
  total: number | null
}

export async function readTicketPage(
  endpoints: LinearEndpoints,
  token: string,
  request: TicketPageRequest,
): Promise<LinearRead<TicketPage>> {
  const term = request.query.trim()
  const { scope } = request
  const variables = { team: scope, teamId: scope, first: TICKET_PAGE_SIZE, after: request.cursor }
  const caller = { endpoints, token }
  const reply = term
    ? await query(caller, SEARCH, { ...variables, term })
    : await query(caller, BACKLOG, variables)
  if (!reply.ok) return reply
  const connection = term ? reply.value.searchIssues : reply.value.issues
  if (!isRecord(connection) || !Array.isArray(connection.nodes)) return failed('unreachable')
  const info = connection.pageInfo
  const more = isRecord(info) && info.hasNextPage === true
  const nextCursor = more && typeof info.endCursor === 'string' ? info.endCursor : null
  const total = connection.totalCount
  return {
    ok: true,
    value: {
      tickets: connection.nodes
        .map((node) => ticket(endpoints, node))
        .filter((entry) => entry !== null),
      statuses: teamStatuses(reply.value.team),
      nextCursor,
      total: typeof total === 'number' && Number.isInteger(total) && total >= 0 ? total : null,
    },
  }
}
