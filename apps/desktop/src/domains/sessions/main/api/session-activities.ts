import { eq } from 'drizzle-orm'
import type { Database } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import { type LiveActivity, liveActivitySchema } from '@/domains/sessions/api/feed/feed-rows'

// The activity each Feed last published, stored so the roster draws the same line the Feed does
// after its reader closes.
export class SessionActivities {
  readonly #database: Database
  readonly #changed: () => void

  constructor(database: Database, changed: () => void) {
    this.#database = database
    this.#changed = changed
  }

  publish(sessionId: string, activity: LiveActivity | null): void {
    const stored = activity === null ? null : JSON.stringify(activity)
    if (this.#stored(sessionId) === stored) return
    this.#database
      .update(sessionTable)
      .set({ activity: stored })
      .where(eq(sessionTable.argoId, sessionId))
      .run()
    this.#changed()
  }

  activityOf(sessionId: string): LiveActivity | null {
    return storedActivity(this.#stored(sessionId) ?? null)
  }

  #stored(sessionId: string): string | null | undefined {
    return this.#database
      .select({ activity: sessionTable.activity })
      .from(sessionTable)
      .where(eq(sessionTable.argoId, sessionId))
      .get()?.activity
  }
}

export function storedActivity(stored: string | null): LiveActivity | null {
  if (stored === null) return null
  const parsed = liveActivitySchema.safeParse(JSON.parse(stored))
  if (parsed.success) return parsed.data
  console.warn('Rejected 1 unsupported stored Session activity.')
  return null
}
