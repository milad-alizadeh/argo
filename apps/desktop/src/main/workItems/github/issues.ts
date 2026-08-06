import {
  type BlockerState,
  type WorkItemStatus,
  type WorkItemView,
  workItemKind,
} from '../../../shared'
import { bucketFor, type StateMap } from '../stateMap'

// One GitHub issue, read out of the API's JSON and turned into a Work Item. Everything the
// provider says is kept verbatim — the status word, the declared type word — and everything
// Argo ranks on is derived beside it, never in place of it.

/** The fields of a REST issue this port actually reads. Narrowed from `unknown` rather than
 * cast, so a payload that changed shape degrades to a skipped row instead of a crash. */
export interface RawIssue {
  id: number
  number: number
  title: string
  url: string
  state: string
  /** GitHub's native closure kind: `completed`, `not_planned`, `duplicate`, or absent. */
  closureReason: string | null
  declaredType: string | null
  childCount: number
  labels: string[]
  updatedAt: number | null
}

const RULED_OUT_REASONS = ['not_planned', 'duplicate']

/** A pull request is an issue on this endpoint and is not a Work Item. */
export function parseIssue(value: unknown): RawIssue | null {
  if (!isRecord(value) || 'pull_request' in value) return null
  if (typeof value.id !== 'number' || typeof value.number !== 'number') return null
  if (typeof value.title !== 'string' || typeof value.state !== 'string') return null
  return {
    id: value.id,
    number: value.number,
    title: value.title,
    url: typeof value.html_url === 'string' ? value.html_url : '',
    state: value.state,
    closureReason: typeof value.state_reason === 'string' ? value.state_reason : null,
    declaredType: readTypeName(value.type),
    childCount: readChildCount(value.sub_issues_summary),
    labels: readLabels(value.labels),
    updatedAt: readTimestamp(value.updated_at),
  }
}

/** The port-qualified id — half of the link Argo stores. GitHub's global issue id rather than
 * its per-repo number, so a blocker in another repo can never collide with a local one. */
export function issueId(issue: RawIssue): string {
  return `github:${issue.id}`
}

export function toWorkItem(issue: RawIssue, projectId: string, map: StateMap): WorkItemView {
  return {
    id: issueId(issue),
    projectId,
    reference: `#${issue.number}`,
    title: issue.title,
    url: issue.url,
    status: issueStatus(issue, map),
    kind: workItemKind(issue.declaredType, issue.childCount > 0),
    declaredType: issue.declaredType,
    parentId: null,
    blockedBy: [],
    labels: issue.labels,
    updatedAt: issue.updatedAt,
  }
}

// The two words, side by side and never conflated: GitHub's own `open`/`closed` exactly as its
// API spells it, and the bucket Argo ranks on. Closure is DERIVED PER-PORT rather than through
// the state-map, because GitHub carries the completed/abandoned distinction in `state_reason`
// rather than in a second status word — which is what keeps `done` and `closed` apart here.
export function issueStatus(issue: RawIssue, map: StateMap): WorkItemStatus {
  if (issue.state !== 'closed') return { word: issue.state, bucket: bucketFor(map, issue.state) }
  const ruledOut = issue.closureReason !== null && RULED_OUT_REASONS.includes(issue.closureReason)
  return { word: issue.state, bucket: ruledOut ? 'closed' : 'done' }
}

// What one `blockedBy` edge is doing, read off the BLOCKER ITSELF. A closure whose kind is
// unreadable satisfies (CONTEXT.md L1): degrading the other way would strand a whole map on a
// missing field, so ruling-out detection degrades to a quieter notice rather than a false stop.
export function blockerState(issue: RawIssue, map: StateMap): BlockerState {
  if (issue.state !== 'closed') return 'blocking'
  return issueStatus(issue, map).bucket === 'closed' ? 'ruled-out' : 'satisfied'
}

function readTypeName(value: unknown): string | null {
  if (!isRecord(value) || typeof value.name !== 'string') return null
  return value.name.trim() === '' ? null : value.name
}

function readChildCount(value: unknown): number {
  if (!isRecord(value) || typeof value.total !== 'number') return 0
  return value.total
}

function readLabels(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((label) => {
    if (typeof label === 'string') return [label]
    return isRecord(label) && typeof label.name === 'string' ? [label.name] : []
  })
}

function readTimestamp(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
