import { and, eq, inArray, sql } from 'drizzle-orm'
import type { Database } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import { type SESSION_SUBAGENT_STATES, sessionSubagent } from '@/database/session-subagent/schema'
import { sessionSubagentSelectSchema } from '@/database/session-subagent/validation'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
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

// A Subagent a watched Session named while it was running.
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
