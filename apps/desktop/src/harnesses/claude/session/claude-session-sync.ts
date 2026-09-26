import path from 'node:path'
import { eq } from 'drizzle-orm'
import type { Database } from '@/database/database'
import { project } from '@/database/project/schema'
import { sessionTable } from '@/database/session/schema'
import { workspace } from '@/database/workspace/schema'
import { createSessionUpsert } from '@/domains/sessions/main/database/upsert-session'
import type { SyncedSessionRecord } from '@/domains/sessions/main/sync/session-sync-machine'
import {
  type ClaudeSessionReader,
  type ClaudeSessionRecord,
  readClaudeSessions,
  systemClaudeSessionReader,
} from '@/harnesses/claude/session/claude-session-reader'

export type SyncedClaudeSession = SyncedSessionRecord

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

function knownSessionIds(database: Database): string[] {
  return database
    .select({ nativeId: sessionTable.nativeId })
    .from(sessionTable)
    .where(eq(sessionTable.harness, 'claude'))
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
  record: ClaudeSessionRecord,
): SyncedClaudeSession {
  if (record.cwd === undefined) return record
  const root = matchRoot(roots, record.cwd)
  return {
    ...record,
    projectId: root?.projectId ?? null,
    workspaceId: root?.workspaceId ?? null,
  }
}

export async function fetchClaudeSessions(request: {
  database: Database
  reportMalformed: (raw: unknown) => void
  reader?: ClaudeSessionReader
}): Promise<SyncedClaudeSession[]> {
  const records = await readClaudeSessions({
    reader: request.reader ?? systemClaudeSessionReader(),
    knownNativeIds: knownSessionIds(request.database),
    reportMalformed: request.reportMalformed,
  })
  const roots = sessionRoots(request.database)
  return records.map((record) => withProjectMatch(roots, record))
}

export function saveClaudeSessions(
  database: Database,
  records: readonly SyncedClaudeSession[],
  committed: () => void = () => {},
): void {
  const batches = Array.from({ length: Math.ceil(records.length / 50) }, (_value, index) =>
    records.slice(index * 50, (index + 1) * 50),
  )
  for (const batch of batches) saveBatch(database, batch, committed)
}

function saveBatch(
  database: Database,
  records: readonly SyncedClaudeSession[],
  committed: () => void,
): void {
  const upsert = createSessionUpsert(database)
  database.$client.exec('BEGIN IMMEDIATE')
  try {
    for (const record of records) {
      upsert({
        harness: 'claude',
        nativeId: record.nativeId,
        customTitle: record.customTitle,
        preview: record.preview,
        firstPrompt: record.firstPrompt,
        cwd: record.cwd,
        projectId: record.projectId,
        workspaceId: record.workspaceId,
        activityAt: record.activityAt,
      })
    }
    database.$client.exec('COMMIT')
    committed()
  } catch (error) {
    database.$client.exec('ROLLBACK')
    throw error
  }
}
