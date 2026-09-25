import { eq } from 'drizzle-orm'
import { project } from '@/database/project/schema'
import { projectSetupCheckpoint } from '@/database/project-tables'
import type { ProjectDatabase } from './sqlite-store'

export function createSetupWorktreePromotion({
  afterWrite,
  database,
}: {
  afterWrite: () => void
  database: ProjectDatabase
}) {
  return (projectId: string, worktreePath: string) => {
    database.transaction((transaction) => {
      transaction.update(project).set({ path: worktreePath }).where(eq(project.id, projectId)).run()
      transaction
        .update(projectSetupCheckpoint)
        .set({ phase: 'ready', worktreePath })
        .where(eq(projectSetupCheckpoint.projectId, projectId))
        .run()
    })
    afterWrite()
  }
}
