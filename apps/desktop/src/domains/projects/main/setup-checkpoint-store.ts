import { eq } from 'drizzle-orm'
import { projectSetupCheckpoint } from '@/database/project-tables'
import type { ProjectDatabase } from './sqlite-store'

export type SetupCheckpoint = Omit<
  typeof projectSetupCheckpoint.$inferSelect,
  'createdAt' | 'updatedAt'
>

export function readSetupCheckpoint(
  database: ProjectDatabase,
  projectId: string,
): SetupCheckpoint | null {
  return (
    database
      .select({
        projectId: projectSetupCheckpoint.projectId,
        worktreePath: projectSetupCheckpoint.worktreePath,
        phase: projectSetupCheckpoint.phase,
        configurationSource: projectSetupCheckpoint.configurationSource,
        documentRevision: projectSetupCheckpoint.documentRevision,
      })
      .from(projectSetupCheckpoint)
      .where(eq(projectSetupCheckpoint.projectId, projectId))
      .get() ?? null
  )
}
