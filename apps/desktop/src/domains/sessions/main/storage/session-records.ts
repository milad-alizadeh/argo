import { and, count, desc, eq, or, sql } from 'drizzle-orm'
import { harnessSchema } from '@/harnesses/harness'
import type { DurableDatabase } from '@/platform/main/storage/durable-database'
import type { SessionList, SessionListItem } from '../../contract/session-list'
import { sessionTable } from './session-table'

const sessionListColumns = {
  argoId: sessionTable.argoId,
  harness: sessionTable.harness,
  nativeId: sessionTable.nativeId,
  projectId: sessionTable.projectId,
  vendorTitle: sessionTable.vendorTitle,
  firstPrompt: sessionTable.firstPrompt,
  updatedAt: sessionTable.updatedAt,
  workingDirectory: sessionTable.workingDirectory,
}

function sessionListItem(
  row: Omit<SessionListItem, 'harness'> & { harness: string },
): SessionListItem {
  return { ...row, harness: harnessSchema.parse(row.harness) }
}

export type SessionIdentity = Pick<
  SessionListItem,
  'argoId' | 'harness' | 'nativeId' | 'projectId' | 'workingDirectory'
>

function sessionIdentity(
  row: Omit<SessionIdentity, 'harness'> & { harness: string },
): SessionIdentity {
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
  request: Pick<SessionList, 'page' | 'pageSize'> & { projectId: string | null; search: string },
): SessionList {
  const { page, pageSize, projectId, search } = request
  const needle = search.trim()
  const matches =
    needle.length === 0
      ? undefined
      : or(
          sql`instr(lower(${sessionTable.vendorTitle}), lower(${needle})) > 0`,
          sql`instr(lower(${sessionTable.firstPrompt}), lower(${needle})) > 0`,
          sql`instr(lower(${sessionTable.nativeId}), lower(${needle})) > 0`,
        )
  const where = and(projectId === null ? undefined : eq(sessionTable.projectId, projectId), matches)
  const total =
    database.select({ total: count() }).from(sessionTable).where(where).get()?.total ?? 0
  return {
    page,
    pageSize,
    indexedTotal: total,
    sessions: database
      .select(sessionListColumns)
      .from(sessionTable)
      .where(where)
      .orderBy(desc(sessionTable.updatedAt), sessionTable.argoId)
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .all()
      .map(sessionListItem),
  }
}

export function readSession(database: DurableDatabase, argoId: string): SessionListItem | null {
  const row = database
    .select(sessionListColumns)
    .from(sessionTable)
    .where(eq(sessionTable.argoId, argoId))
    .get()
  return row === undefined ? null : sessionListItem(row)
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
