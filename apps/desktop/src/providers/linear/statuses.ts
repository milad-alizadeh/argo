// A Linear team's workflow states, and moving one of its issues to another. Linear owns the states;
// the cockpit reads them with every page and keeps none.

import type { StatusChange, TicketStatus } from '@/domains/tickets/contract/ticket'
import { isRecord } from '@/shared/validation'
import type { LinearEndpoints } from './endpoints'
import { failed, type LinearRead, query } from './http'
import { resolvedTarget } from './issue-target'

// More states than a team keeps; a team with more offers the first ones.
const STATE_LIMIT = 100

// The team's states, asked for beside a page of its issues. `team(id:)` takes a String where the
// issue filter takes an ID, so the one scope travels as two variables.
export const TEAM_STATES = `team(id: $teamId) {
  states(first: ${STATE_LIMIT}) { nodes { id name type position } }
}`

const CATEGORIES: readonly TicketStatus['category'][] = [
  'triage',
  'backlog',
  'unstarted',
  'started',
  'completed',
  'canceled',
]

// A state's type as the one vocabulary a view styles by, or null for a type Linear adds later.
export const categoryOf = (value: unknown): TicketStatus['category'] | null =>
  (isRecord(value) && CATEGORIES.find((candidate) => candidate === value.type)) || null

export function statusOf(value: unknown): TicketStatus | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id === '') return null
  const category = categoryOf(value)
  if (typeof value.name !== 'string' || value.name === '' || !category) return null
  return { id: value.id, name: value.name, category }
}

const nodes = (connection: unknown): unknown[] =>
  isRecord(connection) && Array.isArray(connection.nodes) ? connection.nodes : []

// In the order Linear's own board draws them: by category, then by the team's position.
export function teamStatuses(team: unknown): TicketStatus[] {
  const states = nodes(isRecord(team) ? team.states : undefined).filter(isRecord)
  const position = (state: Record<string, unknown>) =>
    typeof state.position === 'number' ? state.position : 0
  const rank = (state: Record<string, unknown>) =>
    CATEGORIES.indexOf(statusOf(state)?.category ?? 'canceled')
  return states
    .sort((left, right) => rank(left) - rank(right) || position(left) - position(right))
    .map(statusOf)
    .filter((entry) => entry !== null)
}

// `issue(id:)` takes the key a person reads, `ENG-12`, as well as Linear's own id.
const TARGET = `query Target($key: String!) {
  issue(id: $key) { id team { id states(first: ${STATE_LIMIT}) { nodes { id } } } }
}`

const MOVE = `mutation Move($id: String!, $state: String!) {
  issueUpdate(id: $id, input: { stateId: $state }) { success issue { state { id name type } } }
}`

type Refusal = 'ticket-not-found' | 'status-unknown'

// The issue is found and checked to be in the Connection's team, and the state to be one of that
// team's, before anything is written.
export async function updateIssueStatus(
  endpoints: LinearEndpoints,
  token: string,
  { scope, key, statusId }: StatusChange,
): Promise<LinearRead<TicketStatus> | { ok: false; failure: Refusal }> {
  const caller = { endpoints, token }
  const resolved = resolvedTarget(await query(caller, TARGET, { key }), scope)
  if (!resolved.ok) return resolved
  const known = nodes(resolved.team.states).some(
    (state) => isRecord(state) && state.id === statusId,
  )
  if (!known) return { ok: false, failure: 'status-unknown' }
  const moved = await query(caller, MOVE, { id: resolved.id, state: statusId })
  if (!moved.ok) return moved
  const payload = isRecord(moved.value.issueUpdate) ? moved.value.issueUpdate : {}
  const status =
    payload.success === true && isRecord(payload.issue) ? statusOf(payload.issue.state) : null
  return status ? { ok: true, value: status } : failed('unreachable')
}
