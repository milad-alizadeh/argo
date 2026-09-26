import { randomUUID } from 'node:crypto'
import { realpath } from 'node:fs/promises'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import type { Database } from '@/database/database'
import { workspace } from '@/database/workspace/schema'
import { type WorkspaceRecord, workspaceRecordSchema } from '@/database/workspace/validation'
import {
  gitCommonDirectory,
  linkedWorktreePaths,
  mainWorktreePath,
} from '@/platform/main/git-worktrees'

type DiscoveredRoot = { path: string; main: boolean }
type ReconciliationContext = {
  database: Database
  project: { id: string; path: string }
  known: WorkspaceRecord[]
  roots: DiscoveredRoot[]
}

function readWorkspaces(database: Database, projectId: string): WorkspaceRecord[] {
  return workspaceRecordSchema.array().parse(
    database
      .select({
        id: workspace.id,
        projectId: workspace.projectId,
        kind: workspace.kind,
        displayName: workspace.displayName,
        path: workspace.path,
      })
      .from(workspace)
      .where(eq(workspace.projectId, projectId))
      .all(),
  )
}

function writeWorkspace(database: Database, record: WorkspaceRecord): void {
  database
    .insert(workspace)
    .values(record)
    .onConflictDoUpdate({ target: workspace.id, set: record })
    .run()
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
  return [...roots].map(([root, isMain]) => ({ path: root, main: isMain }))
}

function reconcileMain({ database, project, known, roots }: ReconciliationContext): void {
  const existing = known.find((candidate) => candidate.kind === 'main')
  const checkoutPath = roots.find((candidate) => candidate.main)?.path ?? project.path
  if (existing !== undefined && existing.path === checkoutPath) return
  writeWorkspace(database, {
    id: existing?.id ?? `workspace-main-${project.id}`,
    projectId: project.id,
    kind: 'main',
    displayName: existing?.displayName ?? 'Main checkout',
    path: checkoutPath,
  })
}

function reconcileImported({ database, project, known, roots }: ReconciliationContext): void {
  const knownPaths = new Set(known.map((candidate) => candidate.path))
  for (const root of roots) {
    if (root.main || knownPaths.has(root.path)) continue
    writeWorkspace(database, {
      id: `workspace-${randomUUID()}`,
      projectId: project.id,
      kind: 'imported',
      displayName: path.basename(root.path) || root.path,
      path: root.path,
    })
  }
}

export async function reconcileWorkspaces(
  database: Database,
  project: { id: string; path: string },
): Promise<WorkspaceRecord[]> {
  const known = readWorkspaces(database, project.id)
  const roots = await discoveredRoots(project.path)
  const context = { database, project, known, roots }
  reconcileMain(context)
  reconcileImported(context)
  return readWorkspaces(database, project.id)
}
