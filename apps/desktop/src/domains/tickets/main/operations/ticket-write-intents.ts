// The durable record of a provider write: kept before the call, settled after its answer. A Ticket
// with an intent still pending or uncertain refuses another, so a write is never sent twice.
import { and, eq, inArray } from 'drizzle-orm'
import type { Database } from '@/database/database'
import type { TicketScopeTarget } from '@/database/ticket/validation'
import { ticketContent } from '@/database/ticket-content/schema'
import { type TICKET_WRITE_PHASES, ticketWriteIntent } from '@/database/ticket-write-intent/schema'
import { nextUpdatedAt } from '@/database/timestamp-columns'
import type { TicketErrorCode } from '@/domains/tickets/api/errors'
import { savedIdentityByKey } from '../database'
import type { TicketOperationRequest } from './ticket-operation-machine'

export type TicketWriteTarget = TicketScopeTarget & { key: string }
export type RecordedIntent = { intentId: string; ticketId: string }
export type RecordIntentResult =
  | ({ ok: true } & RecordedIntent)
  // `not-found` is a Ticket Argo has not saved; `unreconciled` is one an earlier intent still holds.
  | { ok: false; reason: 'not-found' | 'unreconciled' }

const touched = nextUpdatedAt(ticketWriteIntent.updatedAt)
const UNRESOLVED = ['pending', 'uncertain'] as const

function hasUnresolvedIntent(database: Database, ticketId: string): boolean {
  return (
    database
      .select({ intentId: ticketWriteIntent.intentId })
      .from(ticketWriteIntent)
      .where(
        and(eq(ticketWriteIntent.ticketId, ticketId), inArray(ticketWriteIntent.phase, UNRESOLVED)),
      )
      .get() !== undefined
  )
}

// The requested value an intent keeps: the provider status ID or the priority level.
function requestedOf(request: TicketOperationRequest): string {
  switch (request.operation) {
    case 'status':
      return JSON.stringify({ statusId: request.statusId })
    case 'priority':
      return JSON.stringify({ priorityLevel: request.priorityLevel })
    default:
      return request satisfies never
  }
}

// Records an intent for a saved Ticket; a Ticket Argo has not saved has no identity to hold.
export function recordIntent(
  database: Database,
  request: TicketOperationRequest,
): RecordIntentResult {
  const { provider, scope, key } = request
  const ticketId = savedIdentityByKey(database, { provider, scope }, key)
  const base =
    ticketId === undefined
      ? undefined
      : database
          .select({ updatedAt: ticketContent.updatedAt })
          .from(ticketContent)
          .where(eq(ticketContent.ticketId, ticketId))
          .get()
  if (ticketId === undefined || base === undefined) return { ok: false, reason: 'not-found' }
  if (hasUnresolvedIntent(database, ticketId)) return { ok: false, reason: 'unreconciled' }
  const intentId = crypto.randomUUID()
  database
    .insert(ticketWriteIntent)
    .values({
      intentId,
      ticketId,
      operation: request.operation,
      requestedJson: requestedOf(request),
      baseUpdatedAt: base.updatedAt,
      phase: 'pending',
    })
    .run()
  return { ok: true, intentId, ticketId }
}

// An intent still `pending` when the last process stopped: the provider may or may not have
// applied it, so it is never sent again. Recovery settles it by reading the Ticket's native ID.
export function markUnresolvedTicketWriteIntentsUncertain(database: Database): void {
  database
    .update(ticketWriteIntent)
    .set({ phase: 'uncertain', failure: 'connection-lost', updatedAt: touched })
    .where(eq(ticketWriteIntent.phase, 'pending'))
    .run()
}

export function settleIntent(
  database: Pick<Database, 'update'>,
  {
    intentId,
    phase,
    failure = null,
  }: {
    intentId: string
    phase: Exclude<(typeof TICKET_WRITE_PHASES)[number], 'pending'>
    failure?: TicketErrorCode | null
  },
): void {
  database
    .update(ticketWriteIntent)
    .set({ phase, failure, updatedAt: touched })
    .where(eq(ticketWriteIntent.intentId, intentId))
    .run()
}
