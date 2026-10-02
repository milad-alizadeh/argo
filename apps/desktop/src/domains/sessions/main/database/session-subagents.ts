import { eq, inArray, sql } from 'drizzle-orm'
import type { Database } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import { type SESSION_SUBAGENT_STATES, sessionSubagent } from '@/database/session-subagent/schema'
import { sessionSubagentSelectSchema } from '@/database/session-subagent/validation'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
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

// Saves the Subagents delegation content names. Returns how many rows changed.
export function saveSessionSubagents(
  database: Database,
  sessionId: string,
  content: readonly FeedContent[],
): number {
  return saveSessionSubagentFacts(database, sessionId, subagentsOf(content))
}

// A Session's own history names its Subagents, so it is their parent from then on.
export function saveSessionSubagentFacts(
  database: Database,
  sessionId: string,
  subagents: readonly StoredSubagent[],
): number {
  if (subagents.length === 0) return 0
  const parent = database
    .select({ harness: sessionTable.harness })
    .from(sessionTable)
    .where(eq(sessionTable.argoId, sessionId))
    .get()
  if (parent === undefined) return 0
  const { changes } = database
    .insert(sessionSubagent)
    .values(
      subagents.map((subagent) => ({
        harness: parent.harness,
        nativeId: subagent.id,
        parentSessionId: sessionId,
        label: subagent.label,
        state: subagent.state,
      })),
    )
    .onConflictDoUpdate({
      target: [sessionSubagent.harness, sessionSubagent.nativeId],
      // A Subagent that ends names no description, so the label it started with stands.
      set: {
        parentSessionId: sql`excluded.parent_session_id`,
        label: sql`coalesce(excluded.label, ${sessionSubagent.label})`,
        state: sql`excluded.state`,
      },
      setWhere: sql`${sessionSubagent.parentSessionId} is not excluded.parent_session_id or ${sessionSubagent.state} is not excluded.state or coalesce(excluded.label, ${sessionSubagent.label}) is not ${sessionSubagent.label}`,
    })
    .run()
  return Number(changes)
}

export type DiscoveredSubagent = { nativeId: string; parentSessionId: string | null }

// Saves the Subagents discovery found; a null parent is one no saved Session is known to have
// started. Returns those it saved for the first time or gave their first parent.
export function saveDiscoveredSessionSubagents(
  database: Database,
  harness: Harness,
  subagents: readonly DiscoveredSubagent[],
): DiscoveredSubagent[] {
  if (subagents.length === 0) return []
  return database
    .insert(sessionSubagent)
    .values(
      subagents.map((subagent) => ({
        ...subagent,
        harness,
        label: null,
        state: 'unknown' as const,
      })),
    )
    .onConflictDoUpdate({
      target: [sessionSubagent.harness, sessionSubagent.nativeId],
      set: { parentSessionId: sql`excluded.parent_session_id` },
      setWhere: sql`${sessionSubagent.parentSessionId} is null and excluded.parent_session_id is not null`,
    })
    .returning({
      nativeId: sessionSubagent.nativeId,
      parentSessionId: sessionSubagent.parentSessionId,
    })
    .all()
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
    .where(inArray(sessionSubagent.parentSessionId, [...sessionIds]))
    .orderBy(sql`rowid`)
    .all()
  let rejected = 0
  for (const row of rows) {
    const parsed = sessionSubagentSelectSchema.safeParse(row)
    if (!parsed.success || parsed.data.parentSessionId === null) {
      rejected += 1
      continue
    }
    const subagents = bySession.get(parsed.data.parentSessionId) ?? []
    subagents.push({
      id: parsed.data.nativeId,
      label: parsed.data.label,
      state: parsed.data.state,
    })
    bySession.set(parsed.data.parentSessionId, subagents)
  }
  if (rejected > 0) console.warn(`Skipped ${rejected} unrecognised stored Subagent(s).`)
  return bySession
}
