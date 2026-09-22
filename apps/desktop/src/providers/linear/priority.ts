// A Linear team's issues keep a priority, independent of their workflow state. Linear owns the
// levels; the cockpit reads them with every page and keeps none.

import type { PriorityChange, TicketPriority } from '@/domains/tickets/contract/ticket'
import { isRecord } from '@/shared/validation'
import type { LinearEndpoints } from './endpoints'
import { failed, type LinearRead, query } from './http'
import { resolvedTarget } from './issue-target'
import { priorityOf } from './issues'

// `issue(id:)` takes the key a person reads, `ENG-12`, as well as Linear's own id.
const TARGET = `query PriorityTarget($key: String!) {
  issue(id: $key) { id team { id } }
}`

const SET = `mutation SetPriority($id: String!, $priority: Int!) {
  issueUpdate(id: $id, input: { priority: $priority }) { success issue { priority priorityLabel } }
}`

type Refusal = 'ticket-not-found'

// The issue is found and checked to be in the Connection's team before anything is written.
// Linear's priority takes any of 0 through 4, so there is no state to check it against.
export async function updateIssuePriority(
  endpoints: LinearEndpoints,
  token: string,
  { scope, key, priorityLevel }: PriorityChange,
): Promise<LinearRead<TicketPriority | null> | { ok: false; failure: Refusal }> {
  const caller = { endpoints, token }
  const resolved = resolvedTarget(await query(caller, TARGET, { key }), scope)
  if (!resolved.ok) return resolved
  const moved = await query(caller, SET, { id: resolved.id, priority: priorityLevel ?? 0 })
  if (!moved.ok) return moved
  const payload = isRecord(moved.value.issueUpdate) ? moved.value.issueUpdate : {}
  if (payload.success !== true || !isRecord(payload.issue)) return failed('unreachable')
  return { ok: true, value: priorityOf(payload.issue.priority, payload.issue.priorityLabel) }
}
