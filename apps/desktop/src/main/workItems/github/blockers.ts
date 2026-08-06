import type { WorkItemBlocker } from '../../../shared'
import type { StateMap } from '../stateMap'
import type { GitHubClient } from './client'
import { blockerState, issueId, parseIssue, type RawIssue } from './issues'

// `blockedBy`, VERIFIED (CONTEXT.md L1). GitHub's blocked-by endpoint answers with the blocking
// issues themselves, which is why this reads it per issue rather than trusting a summary count:
// a count says how many edges exist, never which a human already resolved. Only OPEN issues are
// asked — a closed item's blockers cannot change what it is.

/** How many blocked-by reads are in flight at once. GitHub secondary-rate-limits a burst, and
 * a backlog of two hundred open issues would be exactly that; a small window keeps a poll
 * inside one round trip's worth of latency without tripping it. */
const READ_WINDOW = 8

export async function readBlockers(
  client: GitHubClient,
  repositoryPath: string,
  context: { issues: RawIssue[]; map: StateMap },
): Promise<Map<string, WorkItemBlocker[]>> {
  const open = context.issues.filter((issue) => issue.state !== 'closed')
  const found = new Map<string, WorkItemBlocker[]>()

  for (let start = 0; start < open.length; start += READ_WINDOW) {
    const window = open.slice(start, start + READ_WINDOW)
    const results = await Promise.all(
      window.map((issue) => readOne(client, repositoryPath, { issue, map: context.map })),
    )
    for (const [index, blockers] of results.entries()) {
      const issue = window[index]
      if (issue !== undefined && blockers.length > 0) found.set(issueId(issue), blockers)
    }
  }
  return found
}

async function readOne(
  client: GitHubClient,
  repositoryPath: string,
  context: { issue: RawIssue; map: StateMap },
): Promise<WorkItemBlocker[]> {
  const number = context.issue.number
  // A repository whose plan does not carry issue dependencies answers 404, and THAT is a
  // provider with no DAG: no edges at all, so the blocked filter no-ops. Every other refusal
  // is thrown on and fails the whole read, because rendering a rate-limited poll as "nothing
  // blocking" would recommend work that is blocked.
  const raw = await client.listOptional(
    `${repositoryPath}/issues/${number}/dependencies/blocked_by?per_page=100`,
  )
  return (raw ?? []).map((value) => toBlocker(value, context.map))
}

// An edge Argo cannot read is still an edge: it blocks, and says `unknown` rather than
// vanishing into a satisfied one (degrade-down).
function toBlocker(value: unknown, map: StateMap): WorkItemBlocker {
  const issue = parseIssue(value)
  if (issue === null) return { id: '', reference: '', state: 'unknown' }
  return { id: issueId(issue), reference: `#${issue.number}`, state: blockerState(issue, map) }
}
