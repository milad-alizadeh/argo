// A managed Workspace is Argo's own worktree: created here, removed only by Argo, and never the
// place an externally created worktree is asked to live (that is `imported`, see
// workspace-reconciliation.ts). Follows the same `git worktree add` shape as
// setup/preparation/setup-worktree.ts, under its own directory so the two never collide.
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import type { WorkspaceRecord, WorkspaceStore } from './workspace-store'

const run = promisify(execFile)
const MANAGED_WORKTREE_DIRECTORY = ['.argo', 'worktrees']

export async function createManagedWorkspace(
  store: WorkspaceStore,
  project: { id: string; path: string },
  baseRef: string,
): Promise<WorkspaceRecord> {
  const id = `workspace-${randomUUID()}`
  const checkoutPath = path.join(project.path, ...MANAGED_WORKTREE_DIRECTORY, id)
  const branch = `argo/${id}`
  await mkdir(path.join(project.path, ...MANAGED_WORKTREE_DIRECTORY), { recursive: true })
  await run('git', ['-C', project.path, 'worktree', 'add', '-b', branch, checkoutPath, baseRef])
  const record: WorkspaceRecord = {
    id,
    projectId: project.id,
    kind: 'managed',
    displayName: branch,
    path: checkoutPath,
    baseRef,
  }
  store.writeWorkspace(record)
  store.selectWorkspace(project.id, id)
  return record
}
