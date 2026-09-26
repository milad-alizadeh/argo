import path from 'node:path'
import { eq } from 'drizzle-orm'
import type { Database } from '@/database/database'
import { project } from '@/database/project/schema'
import { sessionTable } from '@/database/session/schema'
import { workspace } from '@/database/workspace/schema'
import type { Harness } from '@/harnesses/harness'
import { createSessionUpsert } from '../database/session-upsert'
import type { SyncedSessionRecord } from './session-sync-machine'

type SessionRoot = {
  projectId: string
  workspaceId: string | null
  path: string
}

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

function sessionRoots(database: Database): SessionRoot[] {
  const projects = database.select({ id: project.id, path: project.path }).from(project).all()
  const workspaces = database
    .select({ projectId: workspace.projectId, id: workspace.id, path: workspace.path })
    .from(workspace)
    .all()
  return [
    ...projects.map((candidate) => ({
      projectId: candidate.id,
      workspaceId: null,
      path: candidate.path,
    })),
    ...workspaces.map((candidate) => ({
      projectId: candidate.projectId,
      workspaceId: candidate.id,
      path: candidate.path,
    })),
  ]
}

function withProjectMatch(
  roots: readonly SessionRoot[],
  record: SyncedSessionRecord,
): SyncedSessionRecord {
  if (record.cwd == null) return record
  const root = matchRoot(roots, record.cwd)
  return {
    ...record,
    projectId: root?.projectId ?? null,
    workspaceId: root?.workspaceId ?? null,
  }
}

export function matchSessionsToProjects(
  database: Database,
  records: readonly SyncedSessionRecord[],
): SyncedSessionRecord[] {
  const roots = sessionRoots(database)
  return records.map((record) => withProjectMatch(roots, record))
}

export function saveSessionBatch(
  database: Database,
  harness: Harness,
  records: readonly SyncedSessionRecord[],
): void {
  const upsert = createSessionUpsert(database)
  database.$client.exec('BEGIN IMMEDIATE')
  try {
    for (const record of records) {
      upsert({
        ...record,
        harness,
      })
    }
    database.$client.exec('COMMIT')
  } catch (error) {
    database.$client.exec('ROLLBACK')
    throw error
  }
}
