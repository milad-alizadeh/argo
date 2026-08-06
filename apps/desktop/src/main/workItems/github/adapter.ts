import type { WorkItemBlocker, WorkItemView } from '../../../shared'
import type { Http } from '../http'
import type { WorkItemCapabilities, WorkItemProvider, WorkItemRead } from '../port'
import { seedStateMap } from '../stateMap'
import { readBlockers } from './blockers'
import { createGitHubClient, type GitHubClient } from './client'
import { type Hierarchy, inTreeOrder, readHierarchy } from './hierarchy'
import { parseIssue, type RawIssue, toWorkItem } from './issues'

// The GitHub Issues adapter — v1's Work Item provider (ADR-0014), reached over the HTTP API
// with an OAuth device-flow token (ADR-0018) and never over `gh`.

/** GitHub Issues' whole workflow is two words, so the state-map is seeded from that pair and
 * the tier that falls out of it is `bare`: `in-progress` and `in-review` never appear, because
 * a running session does not make a ticket in-progress and an open PR does not make it
 * in-review (#167). The completed/abandoned distinction survives anyway — it lives in
 * `state_reason`, which is what makes this port's `closureKind` native. */
const GITHUB_STATES = seedStateMap([
  { name: 'open', category: 'open' },
  { name: 'closed', category: 'completed' },
])

const CAPABILITIES: WorkItemCapabilities = {
  canAssign: true,
  canComment: true,
  closureKind: 'native',
  tier: GITHUB_STATES.tier,
}

export interface GitHubWorkItemsOptions {
  /** The Project whose backlog this reads. Every item it returns carries it. */
  projectId: string
  owner: string
  repo: string
  http: Http
  token: string
  apiBase?: string
}

export function createGitHubWorkItems(options: GitHubWorkItemsOptions): WorkItemProvider {
  const client = createGitHubClient(options)
  const repoPath = `/repos/${options.owner}/${options.repo}`

  return {
    id: 'github',
    capabilities: () => CAPABILITIES,
    async read(): Promise<WorkItemRead> {
      try {
        return { ok: true, items: await readBacklog(client, repoPath, options.projectId) }
      } catch (error) {
        // A failed poll is never an empty backlog: the caller keeps what it last fetched at
        // full fidelity, so this reports the refusal and changes nothing.
        return { ok: false, detail: error instanceof Error ? error.message : String(error) }
      }
    },
  }
}

async function readBacklog(
  client: GitHubClient,
  repoPath: string,
  projectId: string,
): Promise<WorkItemView[]> {
  // `state=all`, because a done or ruled-out item is still a Work Item — a blocker's own
  // closure is the fact `blockedBy` is verified against.
  const raw = await client.list(`${repoPath}/issues?state=all&per_page=100`)
  const issues = raw.flatMap(readIssue)

  const hierarchy = await readHierarchy(client, repoPath, issues)
  const blockers = await readBlockers(client, repoPath, { issues, map: GITHUB_STATES })

  const items = issues.map((issue) => join(issue, { projectId, hierarchy, blockers }))
  return inTreeOrder(items, hierarchy)
}

function join(
  issue: RawIssue,
  context: {
    projectId: string
    hierarchy: Hierarchy
    blockers: Map<string, WorkItemBlocker[]>
  },
): WorkItemView {
  const item = toWorkItem(issue, context.projectId, GITHUB_STATES)
  return {
    ...item,
    parentId: context.hierarchy.parents.get(item.id) ?? null,
    blockedBy: context.blockers.get(item.id) ?? [],
  }
}

function readIssue(value: unknown): RawIssue[] {
  const issue = parseIssue(value)
  return issue === null ? [] : [issue]
}
