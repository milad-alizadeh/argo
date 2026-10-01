import path from 'node:path'
import { and, eq, inArray } from 'drizzle-orm'
import type { Database } from '@/database/database'
import { project } from '@/database/project/schema'
import { sessionTable } from '@/database/session/schema'
import { sessionSubagent } from '@/database/session-subagent/schema'
import { workspace } from '@/database/workspace/schema'
import type { SessionSubagentLink, SessionSummary } from '@/domains/sessions/api/session-discovery'
import type { Harness } from '@/harnesses/harness'
import { createSessionUpsert } from '../database'

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

function withProjectMatch(roots: readonly SessionRoot[], record: SessionSummary): SessionSummary {
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
  records: readonly SessionSummary[],
): SessionSummary[] {
  const roots = sessionRoots(database)
  return records.map((record) => withProjectMatch(roots, record))
}

export function saveSessionBatch(
  database: Database,
  {
    harness,
    records,
    subagents = [],
  }: {
    harness: Harness
    records: readonly SessionSummary[]
    subagents?: readonly SessionSubagentLink[]
  },
): string[] {
  const upsert = createSessionUpsert(database)
  database.$client.exec('BEGIN IMMEDIATE')
  try {
    const sessionIds = records.map((record) => upsert({ ...record, harness }))
    if (subagents.length > 0) {
      const parentRows = database
        .select({ argoId: sessionTable.argoId, nativeId: sessionTable.nativeId })
        .from(sessionTable)
        .where(
          and(
            eq(sessionTable.harness, harness),
            inArray(sessionTable.nativeId, [
              ...new Set(subagents.map(({ parentNativeId }) => parentNativeId)),
            ]),
          ),
        )
        .all()
      const parentIds = new Map(parentRows.map(({ nativeId, argoId }) => [nativeId, argoId]))
      const links = subagents.flatMap(({ nativeId, parentNativeId }) => {
        const sessionId = parentIds.get(parentNativeId)
        return sessionId === undefined
          ? []
          : [{ sessionId, subagentId: nativeId, label: null, state: 'unknown' as const }]
      })
      if (links.length > 0) {
        const changedParents = database
          .insert(sessionSubagent)
          .values(links)
          .onConflictDoNothing()
          .returning({ sessionId: sessionSubagent.sessionId })
          .all()
          .map(({ sessionId }) => sessionId)
        sessionIds.push(...changedParents)
      }
    }
    database.$client.exec('COMMIT')
    return sessionIds
  } catch (error) {
    database.$client.exec('ROLLBACK')
    throw error
  }
}
