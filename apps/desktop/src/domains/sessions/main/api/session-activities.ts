import { eq } from 'drizzle-orm'
import { sessionTable } from '@/database/session/schema'
import { type LiveActivity, liveActivitySchema } from '@/domains/sessions/api/feed/feed-rows'
import { type SessionUpdateContext, updateSession } from './session-update'

// Keeps a Feed's activity for the roster after its reader closes; a repeat announces nothing.
export function publishActivity(
  context: SessionUpdateContext,
  sessionId: string,
  activity: LiveActivity | null,
): void {
  const stored = context.database
    .select({ activity: sessionTable.activity })
    .from(sessionTable)
    .where(eq(sessionTable.argoId, sessionId))
    .get()?.activity
  if (stored === (activity === null ? null : JSON.stringify(activity))) return
  updateSession(context, sessionId, { activity })
}

export function storedActivity(stored: string | null): LiveActivity | null {
  if (stored === null) return null
  const parsed = liveActivitySchema.safeParse(JSON.parse(stored))
  if (parsed.success) return parsed.data
  console.warn('Rejected 1 unsupported stored Session activity.')
  return null
}
