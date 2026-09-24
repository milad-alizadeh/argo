import path from 'node:path'
import { sql } from 'drizzle-orm'
import { project, workspace } from '@/domains/projects/main/schema'
import type { SessionIngestion } from '@/domains/sessions/contract/session-index'
import type { DurableDatabase } from '@/platform/main/storage/durable-database'
import { sessionTable } from './session-table'

type SessionDatabase =
  | DurableDatabase
  | Parameters<Parameters<DurableDatabase['transaction']>[0]>[0]
type ProjectPath = { id: string; path: string }

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

export function upsertSession(
  database: SessionDatabase,
  session: SessionIngestion,
  projectId: string | null,
): string {
  const { harness, nativeId, firstPrompt, vendorTitle, workingDirectory, updatedAt } = session
  const argoId = crypto.randomUUID()
  const row = database
    .insert(sessionTable)
    .values({
      argoId,
      harness,
      nativeId,
      projectId,
      firstPrompt,
      vendorTitle,
      workingDirectory,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: [sessionTable.harness, sessionTable.nativeId],
      set: {
        projectId: sql`coalesce(excluded.project_id, ${sessionTable.projectId})`,
        firstPrompt: sql`coalesce(excluded.first_prompt, ${sessionTable.firstPrompt})`,
        vendorTitle: sql`coalesce(excluded.vendor_title, ${sessionTable.vendorTitle})`,
        workingDirectory: sql`coalesce(excluded.working_directory, ${sessionTable.workingDirectory})`,
        updatedAt: sql`max(excluded.updated_at, ${sessionTable.updatedAt})`,
      },
    })
    .returning({ argoId: sessionTable.argoId })
    .get()
  if (row === undefined) throw new Error('Session identity did not persist.')
  return row.argoId
}

export function indexSessionIngestions(
  database: DurableDatabase,
  sessions: SessionIngestion[],
  isCancelled: () => boolean = () => false,
) {
  const projectPaths = [
    ...database.select({ id: project.id, path: project.path }).from(project).all(),
    ...database.select({ id: workspace.projectId, path: workspace.path }).from(workspace).all(),
  ]
  return database.transaction((transaction) => {
    for (const session of sessions) {
      if (isCancelled()) throw new Error('Session index worker was cancelled.')
      upsertSession(transaction, session, projectAtPath(projectPaths, session.workingDirectory))
    }
    if (isCancelled()) throw new Error('Session index worker was cancelled.')
  })
}
