// After a complete active scan, each Ticket an earlier scan listed and this one did not is read by
// its native ID: it moved state, left the scope, or the provider confirms it deleted.
import type { Database } from '@/database/database'
import type { TicketScopeTarget } from '@/database/ticket/validation'
import type { TicketErrorCode } from '@/domains/tickets/api/errors'
import type { Ticket } from '@/domains/tickets/api/ticket'
import { type OmittedOutcome, omittedNativeIds, saveOmittedTicket } from '../database'

export type TicketRead =
  | {
      ok: true
      value: Ticket
    }
  | {
      ok: false
      failure: TicketErrorCode
    }

type Resolution = {
  database: Database
  // The Ticket by native ID, read as the Account through Account access.
  readTicket: (
    request: TicketScopeTarget & { accountId: string },
    id: string,
  ) => Promise<TicketRead>
  changed: (target: TicketScopeTarget) => void
}

// The outcome only a definite provider answer gives; any other failure settles nothing.
export function outcomeOf(read: TicketRead): OmittedOutcome | null {
  if (read.ok) return { kind: 'read', ticket: read.value }
  switch (read.failure) {
    case 'ticket-deleted':
      return { kind: 'deleted', at: Date.now() }
    case 'ticket-not-found':
      return { kind: 'elsewhere' }
    default:
      return null
  }
}

// Stops at the first read that settles nothing, such as a refusal or an outage: the rest stay
// omitted and the next complete scan reads them again. Each answer commits on its own.
export async function resolveOmittedTickets(
  { database, readTicket, changed }: Resolution,
  target: TicketScopeTarget,
  { accountId, scanStartedAt }: { accountId: string; scanStartedAt: number },
): Promise<void> {
  const { provider, scope } = target
  for (const nativeId of omittedNativeIds(database, target, scanStartedAt)) {
    const readAt = Date.now()
    const read = await readTicket({ provider, scope, accountId }, nativeId).catch(() => null)
    const outcome = read && outcomeOf(read)
    if (!outcome) return
    saveOmittedTicket(database, { provider, scope, nativeId, readAt }, outcome)
    changed({ provider, scope })
  }
}
