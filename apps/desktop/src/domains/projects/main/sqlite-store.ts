import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { DurableDatabase } from '@/database/durable-database'
import { project } from '@/database/project/schema'
import type { ProjectRow } from '@/database/project/types'
import { projectRegistrationSchema } from '@/database/project/validation'
import { projectSetupCheckpoint } from '@/database/project-tables'
import { createSetupWorktreePromotion } from './project-store-promotion'
import type { ProjectSetupRecord } from './setup/persistence/project-setup-registry'
import { projectSetupStore } from './setup/persistence/project-setup-storage'
import { readSetupCheckpoint, type SetupCheckpoint } from './setup-checkpoint-store'
import { createWorkspaceStore, type WorkspaceStore } from './workspaces/workspace-store'

export type { ProjectSetupRecord } from './setup/persistence/project-setup-registry'
export type { SetupCheckpoint } from './setup-checkpoint-store'
export type {
  ManagedWorkspaceRecovery,
  WorkspaceKind,
  WorkspaceRecord,
} from './workspaces/workspace-store'

export type ProjectRegistration = Pick<ProjectRow, 'id' | 'path' | 'commonDirectory'>
export type ProjectRegistry = { projects: ProjectRegistration[]; selectedId: string | null }
export type ProjectDatabase = DurableDatabase
export type ProjectStore = WorkspaceStore & {
  read: () => ProjectRegistry
  replace: (registry: ProjectRegistry) => void
  insertProject: (project: ProjectRegistration) => void
  selectProject: (projectId: string) => void
  updateProjectPath: (projectId: string, projectPath: string) => void
  promoteSetupWorktree: (projectId: string, worktreePath: string) => void
  readSetupCheckpoint: (projectId: string) => SetupCheckpoint | null
  writeSetupCheckpoint: (checkpoint: SetupCheckpoint) => void
  readProjectSetup: (projectId: string) => ProjectSetupRecord | null
  writeProjectSetup: (record: ProjectSetupRecord) => void
  close: () => void
}

export const isProjectStoreInvalid = (error: unknown): boolean => error instanceof z.ZodError

export function createProjectStore(
  database: ProjectDatabase,
  afterWrite: () => void = () => {},
): ProjectStore {
  let selectedId: string | null = null
  return {
    read: () => readRegistry(database, selectedId),
    replace(registry) {
      database.transaction((transaction) => {
        transaction.delete(project).run()
        if (registry.projects.length) transaction.insert(project).values(registry.projects).run()
      })
      selectedId = registry.selectedId
      afterWrite()
    },
    insertProject: (registration) => {
      database.insert(project).values(registration).run()
      afterWrite()
    },
    selectProject: (projectId) => {
      selectedId = projectId
    },
    updateProjectPath: (projectId, projectPath) => {
      database.update(project).set({ path: projectPath }).where(eq(project.id, projectId)).run()
      afterWrite()
    },
    promoteSetupWorktree: createSetupWorktreePromotion({ afterWrite, database }),
    readSetupCheckpoint: (projectId) => readSetupCheckpoint(database, projectId),
    writeSetupCheckpoint: (checkpoint) => {
      database
        .insert(projectSetupCheckpoint)
        .values(checkpoint)
        .onConflictDoUpdate({ target: projectSetupCheckpoint.projectId, set: checkpoint })
        .run()
      afterWrite()
    },
    ...createWorkspaceStore(database, afterWrite),
    ...projectSetupStore(database, afterWrite),
    close: () => database.$client.close(),
  }
}

function readRegistry(database: ProjectDatabase, selectedId: string | null): ProjectRegistry {
  const registered = projectRegistrationSchema
    .array()
    .parse(
      database
        .select({ id: project.id, path: project.path, commonDirectory: project.commonDirectory })
        .from(project)
        .all(),
    )
  return {
    projects: registered,
    selectedId: registered.some((entry) => entry.id === selectedId) ? selectedId : null,
  }
}
