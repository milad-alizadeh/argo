import { and, eq } from 'drizzle-orm'
import type { Database } from '@/database/database'
import { sessionTable } from '@/database/session/schema'

export function sessionInProject(
  database: Database,
  sessionId: string,
  projectId: string,
): boolean {
  const stored = database
    .select({ argoId: sessionTable.argoId })
    .from(sessionTable)
    .where(and(eq(sessionTable.argoId, sessionId), eq(sessionTable.projectId, projectId)))
    .get()
  return stored !== undefined
}
