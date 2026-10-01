import { and, eq, inArray } from 'drizzle-orm'
import { sessionTicketLink } from '@/database/session-ticket-link/schema'
import type { TicketScopeTarget } from '@/database/ticket/validation'
import {
  type LinkedTicketSource,
  linkedTicketSource,
  type SessionListContext,
  storedSessionQuery,
} from './session-list'

type TicketChangeSource = {
  subscribe: (listener: (target: TicketScopeTarget) => void) => () => void
}
type WatchContext = Pick<SessionListContext, 'database' | 'changes' | 'ticketSource'>
type ShownFact = { scope: string; fact: string }

// The linked Ticket facts each Session row shows, by Session ID, for the Projects `target` names,
// limited to `sessionIds` when given.
async function linkedTicketFacts(
  context: WatchContext,
  target: TicketScopeTarget | null,
  sessionIds: readonly string[] | null = null,
): Promise<Map<string, ShownFact>> {
  const linked = sessionIds === null ? undefined : inArray(sessionTicketLink.sessionId, sessionIds)
  const projects = context.database
    .selectDistinct({ projectId: sessionTicketLink.projectId })
    .from(sessionTicketLink)
    .where(linked)
    .all()
  const sources = await Promise.all(
    projects.map(({ projectId }) => linkedTicketSource(context, projectId)),
  )
  const facts = new Map<string, ShownFact>()
  for (const source of sources) {
    if (source === null || !inScope(source, target)) continue
    const where = and(eq(sessionTicketLink.projectId, source.projectId), linked)
    for (const { id, ticket } of storedSessionQuery(context.database, where, source).all()) {
      const fact = JSON.stringify([ticket.key, ticket.title, ticket.state])
      facts.set(id, { scope: scopeKey(source), fact })
    }
  }
  return facts
}

function inScope(source: LinkedTicketSource, target: TicketScopeTarget | null): boolean {
  return target === null || (source.provider === target.provider && source.scope === target.scope)
}

const scopeKey = ({ provider, scope }: TicketScopeTarget) => JSON.stringify([provider, scope])

// Names the Sessions whose linked Ticket title or state a Ticket save changed. A Ticket change names
// only a provider scope, so the watcher keeps the facts each linked row last showed to compare.
export function watchLinkedTickets(
  context: WatchContext,
  tickets: TicketChangeSource,
): { settled: () => Promise<void>; stop: () => void } {
  const shown = new Map<string, ShownFact>()
  const remember = (facts: Map<string, ShownFact>) => {
    for (const [sessionId, fact] of facts) shown.set(sessionId, fact)
  }
  // One read at a time, so a change always compares against the read before it.
  let reads = linkedTicketFacts(context, null).then(remember)
  const queue = (read: () => Promise<void>) => {
    reads = reads.catch(() => {}).then(read)
    reads.catch((error: unknown) => console.warn('Linked Ticket facts could not be read.', error))
  }
  const stopTickets = tickets.subscribe((target) =>
    queue(async () => {
      const facts = await linkedTicketFacts(context, target)
      const changed = [...facts].filter(([id, { fact }]) => shown.get(id)?.fact !== fact)
      for (const [id, { scope }] of shown)
        if (scope === scopeKey(target) && !facts.has(id)) shown.delete(id)
      remember(facts)
      if (changed.length > 0) context.changes.changed(changed.map(([sessionId]) => sessionId))
    }),
  )
  // A Session linked after the first read is learned silently when its link write is announced.
  const stopSessions = context.changes.subscribe((sessionIds) => {
    const unknown = sessionIds.filter((sessionId) => !shown.has(sessionId))
    if (unknown.length > 0)
      queue(async () => remember(await linkedTicketFacts(context, null, unknown)))
  })
  return {
    // Settles once every read queued so far has finished.
    settled: () => reads.catch(() => {}),
    stop: () => {
      stopTickets()
      stopSessions()
    },
  }
}
