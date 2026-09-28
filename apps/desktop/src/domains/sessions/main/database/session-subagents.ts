import { and, desc, eq, inArray, isNotNull, isNull, ne, or, sql } from 'drizzle-orm'
import type { Database } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import { type SESSION_SUBAGENT_STATES, sessionSubagent } from '@/database/session-subagent/schema'
import { sessionSubagentSelectSchema } from '@/database/session-subagent/validation'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { SessionHistoryReader } from '@/domains/sessions/api/session-history'
import type { Harness } from '@/harnesses/harness'

type Delegation = Extract<FeedContent, { kind: 'delegation' }>
export type StoredSubagent = {
  id: string
  label: string | null
  state: (typeof SESSION_SUBAGENT_STATES)[number]
}

const stateByStatus = {
  pending: 'running',
  running: 'running',
  paused: 'running',
  completed: 'completed',
  failed: 'failed',
  interrupted: 'interrupted',
} as const satisfies Record<Delegation['status'], StoredSubagent['state']>

// The same fold the Feed's Subagents list makes: the newest delegation content per Subagent wins.
function subagentsOf(content: readonly FeedContent[]): StoredSubagent[] {
  const subagents = new Map<string, StoredSubagent>()
  for (const entry of content) {
    if (entry.kind !== 'delegation') continue
    subagents.set(entry.agentId, {
      id: entry.agentId,
      label: entry.name ?? subagents.get(entry.agentId)?.label ?? null,
      state: stateByStatus[entry.status],
    })
  }
  return [...subagents.values()]
}

function unreadSessions(database: Database, harness: Harness) {
  return database
    .select({
      argoId: sessionTable.argoId,
      nativeId: sessionTable.nativeId,
      cwd: sessionTable.cwd,
      activityAt: sessionTable.activityAt,
    })
    .from(sessionTable)
    .where(
      and(
        eq(sessionTable.harness, harness),
        isNotNull(sessionTable.projectId),
        isNotNull(sessionTable.activityAt),
        or(
          isNull(sessionTable.subagentsReadAt),
          ne(sessionTable.subagentsReadAt, sessionTable.activityAt),
        ),
      ),
    )
    .orderBy(desc(sessionTable.activityAt))
    .all()
}

function saveSubagents(
  database: Database,
  session: { argoId: string; activityAt: number | null },
  subagents: readonly StoredSubagent[],
): void {
  database.transaction((transaction) => {
    transaction.delete(sessionSubagent).where(eq(sessionSubagent.sessionId, session.argoId)).run()
    if (subagents.length > 0)
      transaction
        .insert(sessionSubagent)
        .values(
          subagents.map((subagent) => ({
            sessionId: session.argoId,
            subagentId: subagent.id,
            label: subagent.label,
            state: subagent.state,
          })),
        )
        .run()
    transaction
      .update(sessionTable)
      .set({ subagentsReadAt: session.activityAt })
      .where(eq(sessionTable.argoId, session.argoId))
      .run()
  })
}

// Reads the history of each Project Session whose activity moved since its Subagents were stored.
export async function refreshSessionSubagents(input: {
  database: Database
  harness: Harness
  readHistory: SessionHistoryReader
  committed: () => void
  stopped: () => boolean
}): Promise<{ read: number; failed: number }> {
  let read = 0
  let failed = 0
  for (const session of unreadSessions(input.database, input.harness)) {
    if (input.stopped()) break
    try {
      const content = await input.readHistory({
        nativeId: session.nativeId,
        subagentId: null,
        cwd: session.cwd,
      })
      if (input.stopped()) break
      saveSubagents(input.database, session, subagentsOf(content))
      read += 1
    } catch {
      failed += 1
    }
  }
  // One invalidation for the pass: each one also refetches every open Feed.
  if (read > 0) input.committed()
  return { read, failed }
}

export function storedSessionSubagents(
  database: Database,
  sessionIds: readonly string[],
): Map<string, StoredSubagent[]> {
  const bySession = new Map<string, StoredSubagent[]>()
  if (sessionIds.length === 0) return bySession
  const rows = database
    .select()
    .from(sessionSubagent)
    .where(inArray(sessionSubagent.sessionId, [...sessionIds]))
    .orderBy(sql`rowid`)
    .all()
  let rejected = 0
  for (const row of rows) {
    const parsed = sessionSubagentSelectSchema.safeParse(row)
    if (!parsed.success) {
      rejected += 1
      continue
    }
    const subagents = bySession.get(parsed.data.sessionId) ?? []
    subagents.push({
      id: parsed.data.subagentId,
      label: parsed.data.label,
      state: parsed.data.state,
    })
    bySession.set(parsed.data.sessionId, subagents)
  }
  if (rejected > 0) console.warn(`Skipped ${rejected} unrecognised stored Subagent(s).`)
  return bySession
}
