import path from 'node:path'
import { project, workspace } from '@/domains/projects/main/schema'
import type { SessionIngestion } from '@/domains/sessions/contract/session-index'
import type { DurableDatabase } from '@/platform/main/storage/durable-database'
import { upsertSession } from './session-upsert'

type ProjectPath = {
  id: string
  path: string
}

function projectAtPath(projects: ProjectPath[], workingDirectory: string | null): string | null {
  if (workingDirectory === null) return null
  const match = projects
    .filter(({ path: root }) => {
      const relative = path.relative(root, workingDirectory)
      return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
    })
    .sort((left, right) => right.path.length - left.path.length)[0]
  return match?.id ?? null
}

export function indexSessionIngestion(database: DurableDatabase, record: SessionIngestion): string {
  const projectPaths = [
    ...database.select({ id: project.id, path: project.path }).from(project).all(),
    ...database.select({ id: workspace.projectId, path: workspace.path }).from(workspace).all(),
  ]
  return upsertSession(database, record, projectAtPath(projectPaths, record.workingDirectory))
}
