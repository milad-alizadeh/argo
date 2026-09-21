import { eq } from 'drizzle-orm'
import { z } from 'zod'
import {
  managedWorkspaceRecovery,
  projectWorkspaceSelection,
  workspace,
  workspaceKinds,
} from '@/platform/main/storage/database-schema'
import type { ProjectDatabase } from './sqlite-store'

export type WorkspaceRecord = typeof workspace.$inferSelect
export type WorkspaceKind = WorkspaceRecord['kind']
export type ManagedWorkspaceRecovery = typeof managedWorkspaceRecovery.$inferSelect
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
      database.select().from(workspace).where(eq(workspace.projectId, projectId)).all(),
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
      database
        .select()
        .from(managedWorkspaceRecovery)
        .where(eq(managedWorkspaceRecovery.workspaceId, workspaceId))
        .get() ?? null,
  }
}
