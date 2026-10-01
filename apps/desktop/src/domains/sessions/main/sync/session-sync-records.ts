import { realpath } from 'node:fs/promises'
import path from 'node:path'
import { and, eq, isNotNull } from 'drizzle-orm'
import type { Database } from '@/database/database'
import { project } from '@/database/project/schema'
import { sessionTable } from '@/database/session/schema'
import type { SessionSummary } from '@/domains/sessions/api/session-discovery'
import type { Harness } from '@/harnesses/harness'
import { createSessionUpsert } from '../database'
import { projectFolders } from '../worktree'

type SessionRoot = { projectId: string; path: string }

function contains(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate)
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..')
}

function matchRoot(roots: readonly SessionRoot[], cwd: string): SessionRoot | null {
  return (
    roots
      .filter((root) => contains(root.path, cwd))
      .sort((left, right) => right.path.length - left.path.length)[0] ?? null
  )
}

export function knownSessionIds(database: Database, harness: Harness): string[] {
  return database
    .select({ nativeId: sessionTable.nativeId })
    .from(sessionTable)
    .where(eq(sessionTable.harness, harness))
    .all()
    .map((row) => row.nativeId)
}

// Each Project's own folder, its main checkout and every linked worktree git lists for it.
async function sessionRoots(database: Database): Promise<SessionRoot[]> {
  const projects = database.select({ id: project.id, path: project.path }).from(project).all()
  const perProject = await Promise.all(
    projects.map(async (candidate) => {
      const folders = await projectFolders(candidate.path).catch(() => ({
        main: candidate.path,
        linked: [],
      }))
      return [candidate.path, folders.main, ...folders.linked].map((root) => ({
        projectId: candidate.id,
        path: root,
      }))
    }),
  )
  // A Session's own worktree keeps its Project after the folder is gone, so a resume can move it.
  const worktrees = database
    .select({ projectId: sessionTable.projectId, path: sessionTable.worktreePath })
    .from(sessionTable)
    .where(and(isNotNull(sessionTable.projectId), isNotNull(sessionTable.worktreePath)))
    .all()
    .flatMap((row) =>
      row.projectId !== null && row.path !== null ? [{ projectId: row.projectId, path: row.path }] : [],
    )
  return [...perProject.flat(), ...worktrees]
}

// Git lists real paths, so a cwd under a symlink such as macOS's /var matches by its real path too.
async function withProjectMatch(
  roots: readonly SessionRoot[],
  record: SessionSummary,
): Promise<SessionSummary> {
  if (record.cwd == null) return record
  const cwd = record.cwd
  const root = matchRoot(roots, cwd) ?? matchRoot(roots, await realpath(cwd).catch(() => cwd))
  return { ...record, projectId: root?.projectId ?? null }
}

export async function matchSessionsToProjects(
  database: Database,
  records: readonly SessionSummary[],
): Promise<SessionSummary[]> {
  const roots = await sessionRoots(database)
  return Promise.all(records.map((record) => withProjectMatch(roots, record)))
}

export function saveSessionBatch(
  database: Database,
  harness: Harness,
  records: readonly SessionSummary[],
): string[] {
  const upsert = createSessionUpsert(database)
  database.$client.exec('BEGIN IMMEDIATE')
  try {
    const sessionIds = records.map((record) => upsert({ ...record, harness }))
    database.$client.exec('COMMIT')
    return sessionIds
  } catch (error) {
    database.$client.exec('ROLLBACK')
    throw error
  }
}
