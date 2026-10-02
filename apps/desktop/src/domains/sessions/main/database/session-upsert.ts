import { type SQL, sql } from 'drizzle-orm'
import type { z } from 'zod'
import type { Database } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import { sessionInsertSchema } from '@/database/session/validation'

type SessionUpsertInput = z.infer<typeof sessionInsertSchema>

export type SessionUpsert = (input: SessionUpsertInput) => string

type SessionUpsertMetadata = Omit<SessionUpsertInput, 'harness' | 'nativeId'>

function definedMetadata(input: SessionUpsertInput): Partial<SessionUpsertMetadata> {
  return Object.fromEntries(
    Object.entries(input).filter(
      ([key, value]) => key !== 'harness' && key !== 'nativeId' && value !== undefined,
    ),
  ) as Partial<SessionUpsertMetadata>
}

// A scan fills Model, Effort and Mode only while empty, so it never overwrites a newer live save.
function reportedOnlyWhileEmpty(input: SessionUpsertInput) {
  const reported = input.turnConfiguration ? JSON.stringify(input.turnConfiguration) : null
  return { turnConfiguration: sql`coalesce(${sessionTable.turnConfiguration}, ${reported})` }
}

// The later of the stored activity time and a new one, so a late write never ages the row.
export function laterActivityAt(activityAt: number | null): SQL<number | null> {
  const stored = sessionTable.activityAt
  return sql`coalesce(max(${stored}, ${activityAt}), ${stored}, ${activityAt})`
}

// A scan that read Harness history before a later live write never moves the row back in time.
function activityOnlyForward({ activityAt }: SessionUpsertInput) {
  return activityAt === undefined ? {} : { activityAt: laterActivityAt(activityAt) }
}

export function createSessionUpsert(database: Database): SessionUpsert {
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
        worktreePath: validatedInput.worktreePath ?? null,
        worktreeBranch: validatedInput.worktreeBranch ?? null,
        worktreeBase: validatedInput.worktreeBase ?? null,
        customTitle: validatedInput.customTitle ?? null,
        preview: validatedInput.preview ?? null,
        firstPrompt: validatedInput.firstPrompt ?? null,
        cwd: validatedInput.cwd ?? null,
        activityAt: validatedInput.activityAt ?? null,
        turnConfiguration: validatedInput.turnConfiguration ?? null,
        // A Session found in history is ordered by when it was last active, not when Argo saw it.
        createdAt: validatedInput.activityAt ?? Date.now(),
      })
      .onConflictDoUpdate({
        target: [sessionTable.harness, sessionTable.nativeId],
        set: {
          ...metadata,
          ...reportedOnlyWhileEmpty(validatedInput),
          ...activityOnlyForward(validatedInput),
          harness: validatedInput.harness,
          updatedAt: sql`MAX(CAST(unixepoch('subsec') * 1000 AS INTEGER), ${sessionTable.updatedAt} + 1)`,
        },
      })
      .returning({ argoId: sessionTable.argoId })
      .get()
    if (row === undefined) throw new Error('Session identity did not persist.')
    return row.argoId
  }
}
