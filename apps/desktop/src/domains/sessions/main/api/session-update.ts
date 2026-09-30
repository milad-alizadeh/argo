import { initTRPC } from '@trpc/server'
import { and, eq, inArray, or, type SQL, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { Database } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import { sessionArchive } from '@/database/session-archive/schema'
import { nextUpdatedAt } from '@/database/timestamp-columns'
import type { LiveActivity } from '@/domains/sessions/api/feed'
import { WORKING_SESSION_STATUSES } from '@/domains/sessions/api/session-live-event'
import type { Harness } from '@/harnesses/harness'
import { identifierSchema } from '@/shared/validation'
import { sessionHistoryIdentity } from '../session-history-identity'
import type { SessionListChanges } from './session-list-changes'

type StoredUpdate = Pick<typeof sessionTable.$inferInsert, 'customTitle' | 'status' | 'activityAt'>
export type SessionUpdate = {
  [Column in keyof StoredUpdate]?: NonNullable<StoredUpdate[Column]>
} & {
  archived?: boolean
  activity?: LiveActivity | null
}

export type SessionUpdateContext = { database: Database; changes: SessionListChanges }

// The columns an update sets, and for each the condition that it would change the stored value.
function sessionColumns(update: SessionUpdate) {
  const activity =
    update.activity === undefined ? undefined : update.activity && JSON.stringify(update.activity)
  const differs: SQL[] = []
  if (update.customTitle !== undefined)
    differs.push(sql`${sessionTable.customTitle} is not ${update.customTitle}`)
  if (activity !== undefined) differs.push(sql`${sessionTable.activity} is not ${activity}`)
  if (update.status !== undefined) differs.push(sql`${sessionTable.status} is not ${update.status}`)
  if (update.activityAt !== undefined)
    differs.push(sql`coalesce(${sessionTable.activityAt}, 0) < ${update.activityAt}`)
  const columns = {
    ...(update.customTitle === undefined
      ? {}
      : { customTitle: update.customTitle, updatedAt: nextUpdatedAt(sessionTable.updatedAt) }),
    ...(activity === undefined ? {} : { activity }),
    ...(update.status === undefined ? {} : { status: update.status }),
    // Activity only moves forward, so a late write never ages the row.
    ...(update.activityAt === undefined
      ? {}
      : { activityAt: sql`max(coalesce(${sessionTable.activityAt}, 0), ${update.activityAt})` }),
  }
  return { columns, differs }
}

// The one write for a saved Session's own fields. Returns false for an unknown Session, and
// announces the Session only when a stored value changed.
export function updateSession(
  context: SessionUpdateContext,
  sessionId: string,
  update: SessionUpdate,
): boolean {
  const written = context.database.transaction((transaction) => {
    const found = transaction
      .select({ id: sessionTable.argoId })
      .from(sessionTable)
      .where(eq(sessionTable.argoId, sessionId))
      .get()
    if (found === undefined) return undefined
    const { columns, differs } = sessionColumns(update)
    let changes = 0
    if (differs.length > 0)
      changes += Number(
        transaction
          .update(sessionTable)
          .set(columns)
          .where(and(eq(sessionTable.argoId, sessionId), or(...differs)))
          .run().changes,
      )
    if (update.archived === true)
      changes += Number(
        transaction.insert(sessionArchive).values({ sessionId }).onConflictDoNothing().run()
          .changes,
      )
    if (update.archived === false)
      changes += Number(
        transaction.delete(sessionArchive).where(eq(sessionArchive.sessionId, sessionId)).run()
          .changes,
      )
    return changes
  })
  if (written !== undefined && written > 0) context.changes.changed([sessionId])
  return written !== undefined
}

// Updates a Session found by its Harness's own ID. Returns false for one never saved.
export function updateHarnessSession(
  context: SessionUpdateContext,
  session: { harness: Harness; nativeId: string },
  update: SessionUpdate,
): boolean {
  const sessionId = context.database
    .select({ id: sessionTable.argoId })
    .from(sessionTable)
    .where(
      and(eq(sessionTable.harness, session.harness), eq(sessionTable.nativeId, session.nativeId)),
    )
    .get()?.id
  return sessionId !== undefined && updateSession(context, sessionId, update)
}

// A status the last run saw a Session working in cannot still be true after a restart.
export function clearWorkingStatuses(database: Database): void {
  database
    .update(sessionTable)
    .set({ status: 'unknown' })
    .where(inArray(sessionTable.status, [...WORKING_SESSION_STATUSES]))
    .run()
}

const t = initTRPC.create()
const sessionUpdateInputSchema = z
  .strictObject({
    sessionIds: z.array(identifierSchema).min(1),
    // Control characters become spaces, and runs of space become one.
    title: z
      .string()
      .transform((title) =>
        title
          .replace(/\p{Cc}/gu, ' ')
          .trim()
          .replace(/\s+/g, ' '),
      )
      .pipe(z.string().min(1))
      .optional(),
    archived: z.boolean().optional(),
  })
  .refine((input) => input.title === undefined || input.sessionIds.length === 1, {
    message: 'A title renames exactly one Session.',
  })

export type SessionUpdateProcedureContext = SessionUpdateContext & {
  rename: (request: { harness: Harness; nativeId: string; title: string }) => Promise<void>
}

// Renames one saved Session or archives several, and returns the updated IDs. A title goes to the
// Harness first; an unknown ID is skipped.
export function sessionUpdateProcedure(context: SessionUpdateProcedureContext) {
  return t.procedure
    .input(sessionUpdateInputSchema)
    .output(z.strictObject({ sessionIds: z.array(identifierSchema) }))
    .mutation(async ({ input }) => {
      const [renamed] = input.sessionIds
      if (input.title !== undefined && renamed !== undefined) {
        const { harness, nativeId } = sessionHistoryIdentity(context.database, renamed)
        await context.rename({ harness, nativeId, title: input.title })
      }
      const sessionIds = input.sessionIds.filter((sessionId) =>
        updateSession(context, sessionId, { customTitle: input.title, archived: input.archived }),
      )
      return { sessionIds }
    })
}
