import path from 'node:path'
import { and, eq, inArray, isNull, ne, or } from 'drizzle-orm'
import type { Database } from '@/database/database'
import { project } from '@/database/project/schema'
import { sessionTable } from '@/database/session/schema'
import { workspace } from '@/database/workspace/schema'
import type { SessionSubagentLink, SessionSummary } from '@/domains/sessions/api/session-discovery'
import type { Harness } from '@/harnesses/harness'
import { createSessionUpsert, saveDiscoveredSessionSubagents } from '../database'

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
      const childrenByParent = new Map<string, string[]>()
      for (const { nativeId, parentNativeId } of subagents) {
        const children = childrenByParent.get(parentNativeId) ?? []
        children.push(nativeId)
        childrenByParent.set(parentNativeId, children)
        const changedChild = database
          .update(sessionTable)
          .set({ parentNativeId })
          .where(
            and(
              eq(sessionTable.harness, harness),
              eq(sessionTable.nativeId, nativeId),
              or(
                isNull(sessionTable.parentNativeId),
                ne(sessionTable.parentNativeId, parentNativeId),
              ),
            ),
          )
          .returning({ argoId: sessionTable.argoId })
          .get()
        if (changedChild !== undefined) sessionIds.push(changedChild.argoId)
      }
      const parentRows = database
        .select({ argoId: sessionTable.argoId, nativeId: sessionTable.nativeId })
        .from(sessionTable)
        .where(
          and(
            eq(sessionTable.harness, harness),
            inArray(sessionTable.nativeId, [...childrenByParent.keys()]),
          ),
        )
        .all()
      for (const { nativeId, argoId } of parentRows)
        if (
          saveDiscoveredSessionSubagents(database, argoId, childrenByParent.get(nativeId) ?? []) > 0
        )
          sessionIds.push(argoId)
    }
    database.$client.exec('COMMIT')
    return sessionIds
  } catch (error) {
    database.$client.exec('ROLLBACK')
    throw error
  }
}
