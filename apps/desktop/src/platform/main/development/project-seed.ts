import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { Database } from '@/database/database'
import { project } from '@/database/project/schema'
import type { ProjectRegistration } from '@/database/project/validation'
import { repositoryRoot } from '@/platform/main/git-repository-root'
import type { DevelopmentInstance } from './instance'

type Repository = Pick<ProjectRegistration, 'path' | 'commonDirectory'>

export function selectDevelopmentProject(database: Database, repository: Repository): void {
  const existing = database
    .select({ id: project.id, path: project.path })
    .from(project)
    .where(eq(project.commonDirectory, repository.commonDirectory))
    .get()
  if (existing !== undefined) {
    if (existing.path !== repository.path) {
      database
        .update(project)
        .set({ path: repository.path })
        .where(eq(project.id, existing.id))
        .run()
    }
    return
  }
  database
    .insert(project)
    .values({ id: `project-${randomUUID()}`, ...repository })
    .run()
}

export async function seedDevelopmentProject(
  database: Database,
  instance: DevelopmentInstance,
): Promise<void> {
  const repository = await repositoryRoot(instance.worktree)
  if ('failure' in repository) return
  selectDevelopmentProject(database, {
    path: repository.root,
    commonDirectory: repository.commonDirectory,
  })
}
