import path from 'node:path'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { DurableDatabase } from '@/database/durable-database'
import { project, projectSelection, projectSetupCheckpoint } from '@/database/project-tables'
import { identifierSchema } from '@/shared/validation'
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

export type ProjectRegistration = { id: string; path: string; commonDirectory: string }
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

const projectRowSchema = z.strictObject({
  id: identifierSchema,
  path: z.string().refine((value) => path.isAbsolute(value) && !value.includes('\0')),
  commonDirectory: z.string().refine((value) => path.isAbsolute(value) && !value.includes('\0')),
})

export const isProjectStoreInvalid = (error: unknown): boolean => error instanceof z.ZodError

export function createProjectStore(
  database: ProjectDatabase,
  afterWrite: () => void = () => {},
): ProjectStore {
  const writeSelection = (projectId: string) =>
    database
      .insert(projectSelection)
      .values({ singleton: 1, projectId })
      .onConflictDoUpdate({ target: projectSelection.singleton, set: { projectId } })
      .run()
  return {
    read: () => readRegistry(database),
    replace(registry) {
      database.transaction((transaction) => {
        transaction.delete(projectSelection).run()
        transaction.delete(project).run()
        if (registry.projects.length) transaction.insert(project).values(registry.projects).run()
        if (registry.selectedId !== null)
          transaction
            .insert(projectSelection)
            .values({ singleton: 1, projectId: registry.selectedId })
            .run()
      })
      afterWrite()
    },
    insertProject: (registration) => {
      database.insert(project).values(registration).run()
      afterWrite()
    },
    selectProject: (projectId) => {
      writeSelection(projectId)
      afterWrite()
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

function readRegistry(database: ProjectDatabase): ProjectRegistry {
  const registered = projectRowSchema.array().parse(database.select().from(project).all())
  const selected =
    database
      .select({ projectId: projectSelection.projectId })
      .from(projectSelection)
      .where(eq(projectSelection.singleton, 1))
      .get()?.projectId ?? null
  return {
    projects: registered,
    selectedId: registered.some((entry) => entry.id === selected) ? selected : null,
  }
}
