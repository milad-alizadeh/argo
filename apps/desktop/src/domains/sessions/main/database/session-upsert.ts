import type { DurableDatabase } from '@/database/durable-database'
import { sessionTable } from '@/database/session-table'

export type SessionUpsertInput = Omit<
  typeof sessionTable.$inferInsert,
  'argoId' | 'createdAt' | 'updatedAt'
>

export type SessionUpsert = (input: SessionUpsertInput) => string

type SessionUpsertMetadata = Omit<SessionUpsertInput, 'harness' | 'nativeId'>

function definedMetadata(input: SessionUpsertInput): Partial<SessionUpsertMetadata> {
  return Object.fromEntries(
    Object.entries(input).filter(
      ([key, value]) => key !== 'harness' && key !== 'nativeId' && value !== undefined,
    ),
  ) as Partial<SessionUpsertMetadata>
}

export function createSessionUpsert(database: DurableDatabase): SessionUpsert {
  return (input) => {
    const now = Date.now()
    const argoId = crypto.randomUUID()
    const metadata = definedMetadata(input)
    const row = database
      .insert(sessionTable)
      .values({
        argoId,
        harness: input.harness,
        nativeId: input.nativeId,
        projectId: input.projectId ?? null,
        customTitle: input.customTitle ?? null,
        preview: input.preview ?? null,
        firstPrompt: input.firstPrompt ?? null,
        cwd: input.cwd ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [sessionTable.harness, sessionTable.nativeId],
        set: {
          ...metadata,
          updatedAt: now,
        },
      })
      .returning({ argoId: sessionTable.argoId })
      .get()
    if (row === undefined) throw new Error('Session identity did not persist.')
    return row.argoId
  }
}
