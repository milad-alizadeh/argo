// The durable record of a provider write: kept before the call, settled after its answer.
import { eq } from 'drizzle-orm'
import type { Database } from '@/database/database'
import type { TicketScopeTarget } from '@/database/ticket/validation'
import { ticketContent } from '@/database/ticket-content/schema'
import { type TICKET_WRITE_PHASES, ticketWriteIntent } from '@/database/ticket-write-intent/schema'
import { nextUpdatedAt } from '@/database/timestamp-columns'
import type { TicketErrorCode } from '@/domains/tickets/contract/contract'
import { savedIdentityByKey } from '../database/ticket-upsert'
import type { TicketOperationRequest } from './ticket-operation-machine'

export type TicketWriteTarget = TicketScopeTarget & { key: string }
export type RecordedIntent = { intentId: string; ticketId: string }

const touched = nextUpdatedAt(ticketWriteIntent.updatedAt)

// The requested value an intent keeps, such as the provider status ID.
function requestedOf(request: TicketOperationRequest): string {
  return JSON.stringify(
    request.operation === 'status'
      ? { statusId: request.statusId }
      : { priorityLevel: request.priorityLevel },
  )
}

// Records an intent for a saved Ticket; a Ticket Argo has not saved has no identity to hold.
export function recordIntent(
  database: Database,
  request: TicketOperationRequest,
): RecordedIntent | null {
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
  if (ticketId === undefined || base === undefined) return null
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
  return { intentId, ticketId }
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
