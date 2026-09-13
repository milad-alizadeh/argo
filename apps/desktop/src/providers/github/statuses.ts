// GitHub's closure read as a workflow: an issue is open, or closed for one of GitHub's reasons.
// Each status's id is the `state_reason` it is closed with, or `open`.
import { isRecord } from '../../boundary'
import type { StatusChange, TicketStatus } from '../../core/tickets/ticket'
import type { GitHubEndpoints } from './endpoints'
import { failed, type GitHubRead, patch } from './http'

const OPEN: TicketStatus = { id: 'open', name: 'Open', category: 'unstarted' }
const COMPLETED: TicketStatus = {
  id: 'completed',
  name: 'Closed as completed',
  category: 'completed',
}

export const GITHUB_STATUSES: readonly TicketStatus[] = [
  OPEN,
  COMPLETED,
  { id: 'not_planned', name: 'Closed as not planned', category: 'canceled' },
  { id: 'duplicate', name: 'Closed as duplicate', category: 'canceled' },
]

// An issue closed before GitHub kept reasons has none, and reads as completed as GitHub draws it.
export function githubStatus(state: 'open' | 'closed', reason: unknown): TicketStatus {
  if (state === 'open') return OPEN
  return GITHUB_STATUSES.find((status) => status.id === reason) ?? COMPLETED
}

const ISSUE_KEY = /^#([1-9]\d{0,9})$/

export async function updateIssueStatus(
  endpoints: GitHubEndpoints,
  token: string,
  { scope, key, statusId }: StatusChange,
): Promise<GitHubRead<TicketStatus> | { ok: false; failure: 'status-unknown' }> {
  const number = ISSUE_KEY.exec(key)?.[1]
  const target = GITHUB_STATUSES.find((status) => status.id === statusId)
  if (!(number && target)) return { ok: false, failure: 'status-unknown' }
  const change = target === OPEN ? { state: 'open' } : { state: 'closed', state_reason: target.id }
  const written = await patch(`${endpoints.api}/repos/${scope}/issues/${number}`, token, change)
  if (!written.ok) return written
  const { state, state_reason: reason } = isRecord(written.value) ? written.value : {}
  if (state !== 'open' && state !== 'closed') return failed('unreachable')
  return { ok: true, value: githubStatus(state, reason) }
}
