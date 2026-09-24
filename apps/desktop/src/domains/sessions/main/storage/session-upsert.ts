import type { DurableDatabase } from '@/platform/main/storage/durable-database'
import { sessionTable } from './session-table'
export type SessionUpsert = (input: {
  harness: string
  nativeId: string
  projectId: string
  firstPrompt: string
}) => string
export function createSessionUpsert(database: DurableDatabase): SessionUpsert {
  return ({ harness, nativeId, projectId, firstPrompt }) => {
    const argoId = crypto.randomUUID()
    const row = database
      .insert(sessionTable)
      .values({ argoId, harness, nativeId, projectId, firstPrompt, updatedAt: Date.now() })
      .onConflictDoUpdate({
        target: [sessionTable.harness, sessionTable.nativeId],
        set: { nativeId },
      })
      .returning({ argoId: sessionTable.argoId })
      .get()
    if (row === undefined) throw new Error('Session identity did not persist.')
    return row.argoId
  }
}
