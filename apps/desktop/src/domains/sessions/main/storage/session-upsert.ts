import { sql } from 'drizzle-orm'
import type { SessionIngestion } from '@/domains/sessions/contract/session-index'
import type { DurableDatabase } from '@/platform/main/storage/durable-database'
import { sessionTable } from './session-table'
export function upsertSession(
  database: DurableDatabase,
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
