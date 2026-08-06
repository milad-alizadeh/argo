import type { WorkItemView } from '../../../shared'
import type { GitHubClient } from './client'
import { issueId, parseIssue, type RawIssue } from './issues'

// Hierarchy, read from GitHub's sub-issues rather than inferred: which item each child hangs
// off, and the AUTHOR ORDER of a parent's children — the provider's own sub-issue position,
// which "next in <PRD>" ranks on and which no sort of Argo's could reconstruct.
// Only issues whose summary claims children are asked about, so a flat backlog costs one
// request. That summary decides whether to ask and nothing else.

export interface Hierarchy {
  /** Child id → parent id. */
  parents: Map<string, string>
  /** Parent id → its children's ids, in the provider's order. */
  children: Map<string, string[]>
}

export async function readHierarchy(
  client: GitHubClient,
  repositoryPath: string,
  issues: RawIssue[],
): Promise<Hierarchy> {
  const parents = new Map<string, string>()
  const children = new Map<string, string[]>()

  for (const issue of issues.filter((candidate) => candidate.childCount > 0)) {
    const raw = await client.list(
      `${repositoryPath}/issues/${issue.number}/sub_issues?per_page=100`,
    )
    const ids = raw.flatMap(readChildId)
    children.set(issueId(issue), ids)
    for (const id of ids) parents.set(id, issueId(issue))
  }
  return { parents, children }
}

/**
 * The backlog in tree pre-order: roots in the order the provider listed them, each parent
 * immediately followed by its own children in author order. Emitting a flat list in list order
 * would keep `parentId` correct and lose the ordering it was read for, since nothing downstream
 * carries a position field to recover it from.
 *
 * A parent that names itself an ancestor is walked once and then left alone: GitHub does not
 * create such a cycle, but a list assembled across two reads could show one, and looping
 * forever is a worse answer than a slightly odd order.
 */
export function inTreeOrder(items: WorkItemView[], hierarchy: Hierarchy): WorkItemView[] {
  const byId = new Map(items.map((item) => [item.id, item]))
  const ordered: WorkItemView[] = []
  const placed = new Set<string>()

  const walk = (id: string): void => {
    const item = byId.get(id)
    if (item === undefined || placed.has(id)) return
    placed.add(id)
    ordered.push(item)
    for (const child of hierarchy.children.get(id) ?? []) walk(child)
  }

  for (const item of items) {
    if (item.parentId === null || !byId.has(item.parentId)) walk(item.id)
  }
  // A child whose parent never came back from the list read (closed-and-filtered, moved repo)
  // still belongs to the backlog; dropping it would silently shorten it.
  for (const item of items) walk(item.id)
  return ordered
}

function readChildId(value: unknown): string[] {
  const child = parseIssue(value)
  return child === null ? [] : [issueId(child)]
}
