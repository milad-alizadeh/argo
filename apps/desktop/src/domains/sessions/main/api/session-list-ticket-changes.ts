import { eq } from 'drizzle-orm'
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

// The linked Ticket facts each Session row shows, by Session ID, for the Projects `target` names.
async function linkedTicketFacts(
  context: WatchContext,
  target: TicketScopeTarget | null,
): Promise<Map<string, string>> {
  const projects = context.database
    .selectDistinct({ projectId: sessionTicketLink.projectId })
    .from(sessionTicketLink)
    .all()
  const sources = await Promise.all(
    projects.map(({ projectId }) => linkedTicketSource(context, projectId)),
  )
  const facts = new Map<string, string>()
  for (const source of sources) {
    if (source === null || !inScope(source, target)) continue
    const where = eq(sessionTicketLink.projectId, source.projectId)
    for (const { id, ticket } of storedSessionQuery(context.database, where, source).all())
      facts.set(id, JSON.stringify([ticket.key, ticket.title, ticket.state]))
  }
  return facts
}

function inScope(source: LinkedTicketSource, target: TicketScopeTarget | null): boolean {
  return target === null || (source.provider === target.provider && source.scope === target.scope)
}

// Names the Sessions whose linked Ticket title or state a Ticket save changed. A Ticket change names
// only a provider scope, so the watcher keeps the facts each linked row last showed to compare.
export function watchLinkedTickets(
  context: WatchContext,
  tickets: TicketChangeSource,
): { ready: Promise<void>; stop: () => void } {
  const shown = new Map<string, string>()
  const remember = (facts: Map<string, string>) => {
    for (const [sessionId, fact] of facts) shown.set(sessionId, fact)
  }
  // One read at a time, so a change always compares against the read before it.
  let reads = linkedTicketFacts(context, null).then(remember)
  const ready = reads.catch(() => {})
  const unsubscribe = tickets.subscribe((target) => {
    reads = reads
      .catch(() => {})
      .then(async () => {
        const facts = await linkedTicketFacts(context, target)
        const changed = [...facts].filter(([sessionId, fact]) => shown.get(sessionId) !== fact)
        remember(facts)
        if (changed.length > 0) context.changes.changed(changed.map(([sessionId]) => sessionId))
      })
    reads.catch((error: unknown) => console.warn('Linked Ticket facts could not be read.', error))
  })
  return { ready, stop: unsubscribe }
}
