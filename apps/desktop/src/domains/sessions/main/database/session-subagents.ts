import { and, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm'
import type { Database } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import { type SESSION_SUBAGENT_STATES, sessionSubagent } from '@/database/session-subagent/schema'
import { sessionSubagentSelectSchema } from '@/database/session-subagent/validation'
import type { FeedContent } from '@/domains/sessions/api/feed-content'

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

// Saves the Subagents delegation content names. Returns how many rows changed.
export function saveSessionSubagents(
  database: Database,
  sessionId: string,
  content: readonly FeedContent[],
): number {
  return saveSessionSubagentFacts(database, sessionId, subagentsOf(content))
}

export function saveSessionSubagentFacts(
  database: Database,
  sessionId: string,
  subagents: readonly StoredSubagent[],
): number {
  if (subagents.length === 0) return 0
  const { changes } = database
    .insert(sessionSubagent)
    .values(subagentRows(sessionId, subagents))
    .onConflictDoUpdate({
      target: [sessionSubagent.sessionId, sessionSubagent.subagentId],
      // A Subagent that ends names no description, so the label it started with stands.
      set: {
        label: sql`coalesce(excluded.label, ${sessionSubagent.label})`,
        state: sql`excluded.state`,
      },
      setWhere: sql`${sessionSubagent.state} is not excluded.state or coalesce(excluded.label, ${sessionSubagent.label}) is not ${sessionSubagent.label}`,
    })
    .run()
  return (
    Number(changes) +
    classifySavedChildren(
      database,
      sessionId,
      subagents.map(({ id }) => id),
    )
  )
}

export function saveDiscoveredSessionSubagents(
  database: Database,
  sessionId: string,
  childIds: readonly string[],
): number {
  if (childIds.length === 0) return 0
  const { changes } = database
    .insert(sessionSubagent)
    .values(
      childIds.map((subagentId) => ({
        sessionId,
        subagentId,
        label: null,
        state: 'unknown' as const,
      })),
    )
    .onConflictDoNothing()
    .run()
  return Number(changes) + classifySavedChildren(database, sessionId, childIds)
}

function classifySavedChildren(
  database: Database,
  sessionId: string,
  childIds: readonly string[],
): number {
  const parent = database
    .select({ harness: sessionTable.harness, nativeId: sessionTable.nativeId })
    .from(sessionTable)
    .where(eq(sessionTable.argoId, sessionId))
    .get()
  if (parent === undefined) return 0
  const { changes } = database
    .update(sessionTable)
    .set({ parentNativeId: parent.nativeId })
    .where(
      and(
        eq(sessionTable.harness, parent.harness),
        inArray(sessionTable.nativeId, [...new Set(childIds)]),
        or(isNull(sessionTable.parentNativeId), ne(sessionTable.parentNativeId, parent.nativeId)),
      ),
    )
    .run()
  return Number(changes)
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
