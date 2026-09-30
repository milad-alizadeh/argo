import { and, eq, isNull, lt, or } from 'drizzle-orm'
import type { Database } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import type { Harness } from '@/harnesses/harness'

// Announces the saved Sessions a write changed, so each Session List reads just those rows.
export class SessionRosterChanges {
  readonly #listeners = new Set<(sessionIds: readonly string[]) => void>()

  changed(sessionIds: readonly string[]): void {
    if (sessionIds.length === 0) return
    for (const listener of this.#listeners) listener(sessionIds)
  }

  subscribe(listener: (sessionIds: readonly string[]) => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }
}

// A Harness wrote to this Session's history file, so the Session was active just now.
export function recordHistoryActivity(
  database: Database,
  { harness, nativeId, at }: { harness: Harness; nativeId: string; at: number },
): void {
  database
    .update(sessionTable)
    .set({ activityAt: at })
    .where(
      and(
        eq(sessionTable.harness, harness),
        eq(sessionTable.nativeId, nativeId),
        or(isNull(sessionTable.activityAt), lt(sessionTable.activityAt, at)),
      ),
    )
    .run()
}
