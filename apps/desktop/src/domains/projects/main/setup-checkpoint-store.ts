import { eq } from 'drizzle-orm'
import { projectSetupCheckpoint } from '@/platform/main/storage/database-schema'
import type { ProjectDatabase } from './sqlite-store'

export type SetupCheckpoint = typeof projectSetupCheckpoint.$inferSelect

export function readSetupCheckpoint(
  database: ProjectDatabase,
  projectId: string,
): SetupCheckpoint | null {
  return (
    database
      .select()
      .from(projectSetupCheckpoint)
      .where(eq(projectSetupCheckpoint.projectId, projectId))
      .get() ?? null
  )
}
