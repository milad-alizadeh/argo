import type { DurableDatabase } from '@/database/durable-database'
import { sessionTable } from '@/database/session/schema'
import type { NewSession } from '@/database/session/types'
import { sessionInsertSchema } from '@/database/session/validation'

export type SessionUpsertInput = Omit<NewSession, 'argoId' | 'createdAt' | 'updatedAt'>

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
    const validatedInput = sessionInsertSchema.parse(input)
    const argoId = crypto.randomUUID()
    const metadata = definedMetadata(validatedInput)
    const row = database
      .insert(sessionTable)
      .values({
        argoId,
        harness: validatedInput.harness,
        nativeId: validatedInput.nativeId,
        projectId: validatedInput.projectId ?? null,
        customTitle: validatedInput.customTitle ?? null,
        preview: validatedInput.preview ?? null,
        firstPrompt: validatedInput.firstPrompt ?? null,
        cwd: validatedInput.cwd ?? null,
      })
      .onConflictDoUpdate({
        target: [sessionTable.harness, sessionTable.nativeId],
        set: {
          ...metadata,
          harness: validatedInput.harness,
        },
      })
      .returning({ argoId: sessionTable.argoId })
      .get()
    if (row === undefined) throw new Error('Session identity did not persist.')
    return row.argoId
  }
}
