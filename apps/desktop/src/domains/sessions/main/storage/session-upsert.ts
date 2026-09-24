import { sql } from 'drizzle-orm'
import type { DurableDatabase } from '@/platform/main/storage/durable-database'
import { sessionTable } from './session-table'
export type SessionUpsert = (input: {
  harness: string
  nativeId: string
  projectId: string | null
  firstPrompt: string | null
  vendorTitle?: string | null
  workingDirectory?: string | null
  updatedAt?: number
}) => string
export function createSessionUpsert(database: DurableDatabase): SessionUpsert {
  return ({
    harness,
    nativeId,
    projectId,
    firstPrompt,
    vendorTitle = null,
    workingDirectory = null,
    updatedAt = Date.now(),
  }) => {
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
}
