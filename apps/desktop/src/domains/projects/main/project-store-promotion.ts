import type { ProjectDatabase } from './sqlite-store'

type Statement = { run: (...values: string[]) => unknown }

export function createSetupWorktreePromotion({
  afterWrite,
  database,
  updatePath,
}: {
  afterWrite: () => void
  database: ProjectDatabase
  updatePath: Statement
}) {
  const promoteCheckpoint = database.prepare(
    "UPDATE project_setup_checkpoint SET phase = 'ready', worktree_path = ? WHERE project_id = ?",
  )
  return (projectId: string, worktreePath: string) =>
    promoteSetupWorktree({
      afterWrite,
      database,
      projectId,
      promoteCheckpoint,
      updatePath,
      worktreePath,
    })
}

export function promoteSetupWorktree({
  afterWrite,
  database,
  projectId,
  promoteCheckpoint,
  updatePath,
  worktreePath,
}: {
  afterWrite: () => void
  database: ProjectDatabase
  projectId: string
  promoteCheckpoint: Statement
  updatePath: Statement
  worktreePath: string
}): void {
  database.exec('BEGIN')
  try {
    updatePath.run(worktreePath, projectId)
    promoteCheckpoint.run(worktreePath, projectId)
    database.exec('COMMIT')
    afterWrite()
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
}
