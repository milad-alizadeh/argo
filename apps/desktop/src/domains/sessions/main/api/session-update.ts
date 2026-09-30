import { and, eq, inArray } from 'drizzle-orm'
import type { Database } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import { sessionArchive } from '@/database/session-archive/schema'
import { nextUpdatedAt } from '@/database/timestamp-columns'
import type { LiveActivity } from '@/domains/sessions/api/feed/feed-rows'
import { type SessionStatus, WORKING_SESSION_STATUSES } from '@/domains/sessions/api/session-status'
import type { SessionRosterChanges } from './session-roster-changes'

export type SessionUpdate = {
  customTitle?: string
  archived?: boolean
  activity?: LiveActivity | null
  status?: SessionStatus | null
}

export type SessionUpdateContext = { database: Database; roster: SessionRosterChanges }

// The one write for a saved Session's own fields. Returns false for an unknown Session.
export function updateSession(
  context: SessionUpdateContext,
  sessionId: string,
  update: SessionUpdate,
): boolean {
  const known = context.database.transaction((transaction) => {
    const found = transaction
      .select({ id: sessionTable.argoId })
      .from(sessionTable)
      .where(eq(sessionTable.argoId, sessionId))
      .get()
    if (found === undefined) return false
    const columns = {
      ...(update.customTitle === undefined
        ? {}
        : { customTitle: update.customTitle, updatedAt: nextUpdatedAt(sessionTable.updatedAt) }),
      ...(update.activity === undefined
        ? {}
        : { activity: update.activity === null ? null : JSON.stringify(update.activity) }),
      ...(update.status === undefined ? {} : { status: update.status }),
    }
    if (Object.keys(columns).length > 0)
      transaction.update(sessionTable).set(columns).where(eq(sessionTable.argoId, sessionId)).run()
    if (update.archived === true)
      transaction.insert(sessionArchive).values({ sessionId }).onConflictDoNothing().run()
    if (update.archived === false)
      transaction.delete(sessionArchive).where(eq(sessionArchive.sessionId, sessionId)).run()
    return true
  })
  if (known) context.roster.changed([sessionId])
  return known
}

// The Argo ID a Harness's own Session ID was saved under, if it was saved.
export function savedSessionId(
  database: Database,
  harness: string,
  nativeId: string,
): string | undefined {
  return database
    .select({ id: sessionTable.argoId })
    .from(sessionTable)
    .where(and(eq(sessionTable.harness, harness), eq(sessionTable.nativeId, nativeId)))
    .get()?.id
}

// A status the last run saw a Session working in cannot still be true after a restart.
export function clearWorkingStatuses(database: Database): void {
  database
    .update(sessionTable)
    .set({ status: 'unknown' })
    .where(inArray(sessionTable.status, [...WORKING_SESSION_STATUSES]))
    .run()
}
