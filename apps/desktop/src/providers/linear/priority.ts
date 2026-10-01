// A Linear team's issues keep a priority, independent of their workflow state. Linear owns the
// levels; the app reads them from Linear and keeps none.

import type { PriorityChange, TicketPriority } from '@/domains/tickets/api/ticket'
import type { LinearEndpoints } from '@/providers/linear/endpoints'
import { failed, type LinearRead, query } from '@/providers/linear/http'
import { resolvedTarget } from '@/providers/linear/issue-target'
import { priorityOf } from '@/providers/linear/issues'
import { isRecord } from '@/shared/validation'

// `issue(id:)` takes the key a person reads, `ENG-12`, as well as Linear's own id.
const TARGET = `query PriorityTarget($key: String!) {
  issue(id: $key) { id team { id } }
}`

const SET = `mutation SetPriority($id: String!, $priority: Int!) {
  issueUpdate(id: $id, input: { priority: $priority }) { success issue { priority priorityLabel } }
}`

// Linear lists its levels itself, with "No priority" (0) among them; that one is no choice.
const CHOICES = `query PriorityChoices {
  issuePriorityValues { priority label }
}`

type Refusal = 'ticket-not-found'

export async function readPriorityChoices(
  endpoints: LinearEndpoints,
  token: string,
): Promise<LinearRead<readonly TicketPriority[]>> {
  const read = await query({ endpoints, token }, CHOICES)
  if (!read.ok) return read
  const rows = read.value.issuePriorityValues
  if (!Array.isArray(rows)) return failed('unreachable')
  // "No priority" (0) is no choice; any other row that is not a known level rejects the payload.
  const choices: TicketPriority[] = []
  for (const row of rows) {
    if (!isRecord(row)) return failed('unreachable')
    if (row.priority === 0) continue
    const choice = priorityOf(row.priority, row.label)
    if (!choice) return failed('unreachable')
    choices.push(choice)
  }
  choices.sort((first, second) => first.level - second.level)
  return { ok: true, value: choices }
}

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
