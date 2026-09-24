import { and, eq } from 'drizzle-orm'
import type { DurableDatabase } from '@/platform/main/storage/durable-database'
import { sessionTable } from './session-table'
export type SessionUpsert = (input: {
  harness: string
  nativeId: string
  firstPrompt: string
}) => string
export function createSessionUpsert(database: DurableDatabase): SessionUpsert {
  return ({ harness, nativeId, firstPrompt }) => {
    const argoId = crypto.randomUUID()
    database
      .insert(sessionTable)
      .values({ argoId, harness, nativeId, firstPrompt, updatedAt: Date.now() })
      .onConflictDoNothing()
      .run()
    const row = database
      .select({ argoId: sessionTable.argoId })
      .from(sessionTable)
      .where(and(eq(sessionTable.harness, harness), eq(sessionTable.nativeId, nativeId)))
      .get()
    if (row === undefined) throw new Error('Session identity did not persist.')
    return row.argoId
  }
}
