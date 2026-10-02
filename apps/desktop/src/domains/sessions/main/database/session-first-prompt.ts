import { and, eq, isNull, sql } from 'drizzle-orm'
import type { Database } from '@/database/database'
import { sessionTable } from '@/database/session/schema'

// The name a Session's own transcript gives it: its preview, else its first prompt; null when blank.
export const transcriptName = sql<
  string | null
>`coalesce(nullif(${sessionTable.preview}, ''), nullif(${sessionTable.firstPrompt}, ''))`

// Saves a sent prompt as the first prompt of a Session no title or transcript names; true when it did.
export function saveFirstPromptOfUntitled(database: Database, sessionId: string, prompt: string) {
  if (prompt === '') return false
  return (
    database
      .update(sessionTable)
      .set({ firstPrompt: prompt })
      .where(
        and(
          eq(sessionTable.argoId, sessionId),
          isNull(sessionTable.customTitle),
          sql`${transcriptName} is null`,
        ),
      )
      .run().changes > 0
  )
}
