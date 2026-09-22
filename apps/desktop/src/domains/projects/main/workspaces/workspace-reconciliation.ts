// Reconciling a Project's durable Workspace records against what git actually has on disk. Lazy:
// called when a Project's Workspaces are asked for, never a background scan.
import { randomUUID } from 'node:crypto'
import { realpath } from 'node:fs/promises'
import path from 'node:path'
import {
  gitCommonDirectory,
  linkedWorktreePaths,
  mainWorktreePath,
} from '@/platform/main/git-worktrees'
import { readWorkspaceFacts } from './workspace-facts'
import type { WorkspaceRecord, WorkspaceStore } from './workspace-store'

type DiscoveredRoot = { path: string; main: boolean }
type ReconciliationContext = {
  store: WorkspaceStore
  project: { id: string; path: string }
  known: WorkspaceRecord[]
  roots: DiscoveredRoot[]
}

async function discoveredRoots(projectPath: string): Promise<DiscoveredRoot[]> {
  const common = await gitCommonDirectory(projectPath)
  const main = mainWorktreePath(common)
  const linked = await linkedWorktreePaths(common)
  const roots = new Map<string, boolean>()
  if (main !== null) roots.set(await realpath(main).catch(() => main), true)
  for (const candidate of linked) {
    const resolved = await realpath(candidate).catch(() => candidate)
    if (!roots.has(resolved)) roots.set(resolved, false)
  }
  return [...roots].map(([root, main]) => ({ path: root, main }))
}

// The main checkout keeps one stable id for the life of the Project: relocation moves its `path`,
// it never mints a second Workspace for the same Project.
async function reconcileMain({
  store,
  project,
  known,
  roots,
}: ReconciliationContext): Promise<void> {
  const existing = known.find((workspace) => workspace.kind === 'main')
  const root = roots.find((candidate) => candidate.main)
  const checkoutPath = root?.path ?? project.path
  if (existing !== undefined && existing.path === checkoutPath) return
  store.writeWorkspace({
    id: existing?.id ?? `workspace-main-${project.id}`,
    projectId: project.id,
    kind: 'main',
    displayName: existing?.displayName ?? 'Main checkout',
    path: checkoutPath,
    baseRef: existing?.baseRef ?? 'HEAD',
  })
}

// A path git reports that Argo has no Workspace for yet, under a Project it already knows: an
// externally created worktree, imported once and never re-imported by path.
async function reconcileImported({
  store,
  project,
  known,
  roots,
}: ReconciliationContext): Promise<void> {
  const knownPaths = new Set(known.map((workspace) => workspace.path))
  for (const root of roots) {
    if (root.main || knownPaths.has(root.path)) continue
    const facts = await readWorkspaceFacts(root.path)
    store.writeWorkspace({
      id: `workspace-${randomUUID()}`,
      projectId: project.id,
      kind: 'imported',
      displayName: facts.branch ?? path.basename(root.path) ?? root.path,
      path: root.path,
      baseRef: facts.branch ?? 'HEAD',
    })
  }
}

// An Argo-managed Workspace whose checkout git no longer reports is not deleted here: recovery is
// recorded so the app can offer to recreate or forget it, and the Workspace keeps its identity.
function reconcileManagedRecovery(
  { store, known, roots }: ReconciliationContext,
  now: () => Date,
): void {
  for (const workspace of known) {
    if (workspace.kind !== 'managed') continue
    if (roots.some((root) => root.path === workspace.path)) continue
    if (store.readManagedWorkspaceRecovery(workspace.id) !== null) continue
    store.writeManagedWorkspaceRecovery({
      workspaceId: workspace.id,
      checkoutRemovedAt: now().toISOString(),
    })
  }
}

export async function reconcileWorkspaces(
  store: WorkspaceStore,
  project: { id: string; path: string },
  now: () => Date = () => new Date(),
): Promise<WorkspaceRecord[]> {
  const known = store.readWorkspaces(project.id)
  const roots = await discoveredRoots(project.path)
  const context: ReconciliationContext = { store, project, known, roots }
  await reconcileMain(context)
  await reconcileImported(context)
  reconcileManagedRecovery(context, now)
  return store.readWorkspaces(project.id)
}
