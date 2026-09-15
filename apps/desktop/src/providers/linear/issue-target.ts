// The issue and team a write's `TARGET` query answers, resolved once and checked against the
// Connection's team before anything is written. Shared by every write that owns this check.
import { isRecord } from '../../boundary'
import type { LinearFailure, LinearRead } from './http'

type TargetIssue = { issue?: unknown }
type Resolved =
  | { ok: true; id: string; team: Record<string, unknown> }
  | { ok: false; failure: LinearFailure | 'ticket-not-found' }

export function resolvedTarget(target: LinearRead<TargetIssue>, scope: string): Resolved {
  if (!target.ok) return target
  const issue = isRecord(target.value.issue) ? target.value.issue : {}
  const team = isRecord(issue.team) ? issue.team : {}
  if (typeof issue.id !== 'string' || team.id !== scope) {
    return { ok: false, failure: 'ticket-not-found' }
  }
  return { ok: true, id: issue.id, team }
}
