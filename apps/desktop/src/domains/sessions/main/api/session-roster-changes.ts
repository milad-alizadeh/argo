import { and, eq, isNull, lt, or, sql } from 'drizzle-orm'
import type { Database } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import type { Harness } from '@/harnesses/harness'

// Announces that some roster row may have changed; each roster reader works out which one.
export class SessionRosterChanges {
  readonly #listeners = new Set<() => void>()

  changed(): void {
    for (const listener of this.#listeners) listener()
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }
}

// A Harness wrote to this Session's history file, so the Session was active just now. Only a Turn
// transition moves it in the Session List order, so a streaming Turn does not reorder every write.
export function recordHistoryActivity(
  database: Database,
  {
    harness,
    nativeId,
    at,
    turnChanged,
  }: { harness: Harness; nativeId: string; at: number; turnChanged: boolean },
): void {
  database
    .update(sessionTable)
    .set({
      activityAt: at,
      ...(turnChanged ? { listOrderAt: sql`MAX(${sessionTable.listOrderAt}, ${at})` } : {}),
    })
    .where(
      and(
        eq(sessionTable.harness, harness),
        eq(sessionTable.nativeId, nativeId),
        or(isNull(sessionTable.activityAt), lt(sessionTable.activityAt, at)),
      ),
    )
    .run()
}
