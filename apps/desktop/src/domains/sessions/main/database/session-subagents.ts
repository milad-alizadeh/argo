import { and, desc, eq, inArray, isNotNull, isNull, ne, or, sql } from 'drizzle-orm'
import type { Database } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import { type SESSION_SUBAGENT_STATES, sessionSubagent } from '@/database/session-subagent/schema'
import { sessionSubagentSelectSchema } from '@/database/session-subagent/validation'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { SessionHistoryReader } from '@/domains/sessions/api/session-history'
import type { SessionLiveEventBody } from '@/domains/sessions/api/session-live-event'
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

function subagentRows(sessionId: string, subagents: readonly StoredSubagent[]) {
  return subagents.map((subagent) => ({
    sessionId,
    subagentId: subagent.id,
    label: subagent.label,
    state: subagent.state,
  }))
}

// A Subagent a watched Session named while it was running. The Session's `subagentsReadAt` is left
// alone, so the next sync pass still reads its whole history and corrects anything missed here.
export function recordLiveSubagents(
  database: Database,
  input: { harness: Harness; nativeId: string; events: readonly SessionLiveEventBody[] },
): void {
  const subagents = subagentsOf(
    input.events.flatMap((event) => (event.type === 'content' ? [event.content] : [])),
  )
  if (subagents.length === 0) return
  const session = database
    .select({ argoId: sessionTable.argoId })
    .from(sessionTable)
    .where(and(eq(sessionTable.harness, input.harness), eq(sessionTable.nativeId, input.nativeId)))
    .get()
  if (session === undefined) return
  database
    .insert(sessionSubagent)
    .values(subagentRows(session.argoId, subagents))
    .onConflictDoUpdate({
      target: [sessionSubagent.sessionId, sessionSubagent.subagentId],
      // A Subagent that ends names no description, so the label it started with stands.
      set: {
        label: sql`coalesce(excluded.label, ${sessionSubagent.label})`,
        state: sql`excluded.state`,
      },
    })
    .run()
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

type ReadSession = { argoId: string; activityAt: number | null }

// The activity the stored Subagents were read from, so the next pass skips a Session that stood still.
function stampSubagentsRead(writer: Pick<Database, 'update'>, session: ReadSession): void {
  writer
    .update(sessionTable)
    .set({ subagentsReadAt: session.activityAt })
    .where(eq(sessionTable.argoId, session.argoId))
    .run()
}

function saveSubagents(
  database: Database,
  session: ReadSession,
  subagents: readonly StoredSubagent[],
): void {
  database.transaction((transaction) => {
    transaction.delete(sessionSubagent).where(eq(sessionSubagent.sessionId, session.argoId)).run()
    if (subagents.length > 0)
      transaction.insert(sessionSubagent).values(subagentRows(session.argoId, subagents)).run()
    stampSubagentsRead(transaction, session)
  })
}

// Reads the history of each Project Session whose activity moved since its Subagents were stored,
// newest first, and reports each one as it is stored.
export async function refreshSessionSubagents(input: {
  database: Database
  harness: Harness
  readHistory: SessionHistoryReader
  stored: () => void
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
      // A history that cannot be read keeps the rows it has, and is stamped so the next pass skips
      // it until its activity moves again.
      stampSubagentsRead(input.database, session)
      failed += 1
    }
    input.stored()
  }
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
