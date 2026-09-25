import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { managedWorkspaceRecovery } from '@/database/managed-workspace-recovery/schema'
import type { ManagedWorkspaceRecoveryRow } from '@/database/managed-workspace-recovery/types'
import { projectWorkspaceSelection } from '@/database/project-workspace-selection/schema'
import { workspace, workspaceKinds } from '@/database/workspace/schema'
import type { WorkspaceRow } from '@/database/workspace/types'
import type { ProjectDatabase } from '../sqlite-store'

export type WorkspaceRecord = Omit<WorkspaceRow, 'createdAt' | 'updatedAt'>
export type WorkspaceKind = WorkspaceRecord['kind']
export type ManagedWorkspaceRecovery = Omit<ManagedWorkspaceRecoveryRow, 'createdAt' | 'updatedAt'>
export type WorkspaceStore = {
  readWorkspaces: (projectId: string) => WorkspaceRecord[]
  writeWorkspace: (workspace: WorkspaceRecord) => void
  selectWorkspace: (projectId: string, workspaceId: string) => void
  readWorkspaceSelection: (projectId: string) => string | null
  writeManagedWorkspaceRecovery: (recovery: ManagedWorkspaceRecovery) => void
  readManagedWorkspaceRecovery: (workspaceId: string) => ManagedWorkspaceRecovery | null
}
const workspaceKindSchema = z.enum(workspaceKinds)
const workspaceOwnerSchema = z.strictObject({
  projectId: z.string().min(1),
  kind: workspaceKindSchema,
})
const workspaceRecordColumns = {
  id: workspace.id,
  projectId: workspace.projectId,
  kind: workspace.kind,
  displayName: workspace.displayName,
  path: workspace.path,
  baseRef: workspace.baseRef,
}
const managedWorkspaceRecoveryColumns = {
  workspaceId: managedWorkspaceRecovery.workspaceId,
  checkoutRemovedAt: managedWorkspaceRecovery.checkoutRemovedAt,
}

function readManagedWorkspaceRecovery(database: ProjectDatabase, workspaceId: string) {
  return (
    database
      .select(managedWorkspaceRecoveryColumns)
      .from(managedWorkspaceRecovery)
      .where(eq(managedWorkspaceRecovery.workspaceId, workspaceId))
      .get() ?? null
  )
}

export function createWorkspaceStore(
  database: ProjectDatabase,
  afterWrite: () => void,
): WorkspaceStore {
  const owner = (workspaceId: string) =>
    workspaceOwnerSchema.parse(
      database
        .select({ projectId: workspace.projectId, kind: workspace.kind })
        .from(workspace)
        .where(eq(workspace.id, workspaceId))
        .get(),
    )
  return {
    readWorkspaces: (projectId) =>
      database
        .select(workspaceRecordColumns)
        .from(workspace)
        .where(eq(workspace.projectId, projectId))
        .all(),
    writeWorkspace: (record) => {
      database
        .insert(workspace)
        .values(record)
        .onConflictDoUpdate({ target: workspace.id, set: record })
        .run()
      afterWrite()
    },
    selectWorkspace: (projectId, workspaceId) => {
      if (owner(workspaceId).projectId !== projectId)
        throw new RangeError('Workspace belongs to another Project')
      database
        .insert(projectWorkspaceSelection)
        .values({ projectId, workspaceId })
        .onConflictDoUpdate({ target: projectWorkspaceSelection.projectId, set: { workspaceId } })
        .run()
      afterWrite()
    },
    readWorkspaceSelection: (projectId) =>
      database
        .select({ workspaceId: projectWorkspaceSelection.workspaceId })
        .from(projectWorkspaceSelection)
        .where(eq(projectWorkspaceSelection.projectId, projectId))
        .get()?.workspaceId ?? null,
    writeManagedWorkspaceRecovery: (recovery) => {
      if (owner(recovery.workspaceId).kind !== 'managed')
        throw new RangeError('Only managed Workspaces have recovery')
      database
        .insert(managedWorkspaceRecovery)
        .values(recovery)
        .onConflictDoUpdate({ target: managedWorkspaceRecovery.workspaceId, set: recovery })
        .run()
      afterWrite()
    },
    readManagedWorkspaceRecovery: (workspaceId) =>
      readManagedWorkspaceRecovery(database, workspaceId),
  }
}
