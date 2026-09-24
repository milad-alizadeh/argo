import { and, count, desc, eq } from 'drizzle-orm'
import { type Harness, harnessSchema } from '@/harnesses/harness'
import type { DurableDatabase } from '@/platform/main/storage/durable-database'
import { sessionTable } from './session-table'

export type SessionIdentity = {
  argoId: string
  harness: Harness
  nativeId: string
  projectId: string | null
  workingDirectory: string | null
}

export type SessionList = {
  page: number
  pageSize: number
  indexedTotal: number
  sessions: Array<{
    argoId: string
    harness: Harness
    nativeId: string
    projectId: string | null
    vendorTitle: string | null
    firstPrompt: string | null
    updatedAt: number
    workingDirectory: string | null
  }>
}

type SessionListRequest = {
  page: number
  pageSize: number
  projectId: string | null
}

function sessionIdentity(row: {
  argoId: string
  harness: string
  nativeId: string
  projectId: string | null
  workingDirectory: string | null
}): SessionIdentity {
  return { ...row, harness: harnessSchema.parse(row.harness) }
}

export function readSessionIdentity(
  database: DurableDatabase,
  argoId: string,
): SessionIdentity | null {
  const row =
    database
      .select({
        argoId: sessionTable.argoId,
        harness: sessionTable.harness,
        nativeId: sessionTable.nativeId,
        projectId: sessionTable.projectId,
        workingDirectory: sessionTable.workingDirectory,
      })
      .from(sessionTable)
      .where(eq(sessionTable.argoId, argoId))
      .get() ?? null
  return row === null ? null : sessionIdentity(row)
}

export function readSessionList(
  database: DurableDatabase,
  request: SessionListRequest,
): SessionList {
  const { page, pageSize, projectId } = request
  const where = projectId === null ? undefined : eq(sessionTable.projectId, projectId)
  const total =
    database.select({ total: count() }).from(sessionTable).where(where).get()?.total ?? 0
  return {
    page,
    pageSize,
    indexedTotal: total,
    sessions: database
      .select({
        argoId: sessionTable.argoId,
        harness: sessionTable.harness,
        nativeId: sessionTable.nativeId,
        projectId: sessionTable.projectId,
        vendorTitle: sessionTable.vendorTitle,
        firstPrompt: sessionTable.firstPrompt,
        updatedAt: sessionTable.updatedAt,
        workingDirectory: sessionTable.workingDirectory,
      })
      .from(sessionTable)
      .where(where)
      .orderBy(desc(sessionTable.updatedAt), sessionTable.argoId)
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .all()
      .map((session) => ({ ...session, harness: harnessSchema.parse(session.harness) })),
  }
}

export function findSessionByVendorIdentity(
  database: DurableDatabase,
  harness: string,
  nativeId: string,
): SessionIdentity | null {
  const row =
    database
      .select({
        argoId: sessionTable.argoId,
        harness: sessionTable.harness,
        nativeId: sessionTable.nativeId,
        projectId: sessionTable.projectId,
        workingDirectory: sessionTable.workingDirectory,
      })
      .from(sessionTable)
      .where(and(eq(sessionTable.harness, harness), eq(sessionTable.nativeId, nativeId)))
      .get() ?? null
  return row === null ? null : sessionIdentity(row)
}
