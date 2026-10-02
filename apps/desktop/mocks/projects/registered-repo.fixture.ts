import path from 'node:path'
import { onTestFinished } from 'vitest'
import { project } from '@/database/project/schema'
import { migratedDatabase } from '@/mocks/database/migrated-database'
import { worktreeRepoFixture } from './worktree-repo.fixture'

// A real repository registered as `project-1` in a fresh database, both gone when the test ends.
export async function registeredRepoFixture() {
  const { project: repository } = await worktreeRepoFixture({
    after: (cleanup) => onTestFinished(cleanup),
  })
  const database = migratedDatabase()
  onTestFinished(() => database.$client.close())
  database
    .insert(project)
    .values({ id: 'project-1', path: repository, commonDirectory: path.join(repository, '.git') })
    .run()
  return { repository, database, worktreeRoot: path.join(path.dirname(repository), 'worktrees') }
}
