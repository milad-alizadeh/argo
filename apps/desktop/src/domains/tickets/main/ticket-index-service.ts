// The Ticket screen's reads from SQLite and its requests for a fresh provider scan.
import { z } from 'zod'
import { ticketSyncStateSchema } from '@/database/ticket-sync/validation'
import { TICKET_PAGE_SIZE, ticketErrorSchema } from '@/domains/tickets/contract/contract'
import { ticket, ticketStatus } from '@/domains/tickets/contract/ticket'
import { identifier, message } from '@/shared/messages'
import { readActiveTickets } from './database/ticket-queries'
import type { Call } from './read-as'
import { writableConnection } from './service'

// One numbered page of the active Tickets saved in SQLite, and the scan state behind them.
export const ticketIndexedOutputSchema = z.union([
  message('ticket.indexed', {
    projectId: identifier,
    scope: identifier,
    tickets: z.array(ticket),
    statuses: z.array(ticketStatus),
    page: z.int().nonnegative(),
    pageSize: z.int().positive(),
    total: z.int().nonnegative(),
    sync: ticketSyncStateSchema,
  }),
  ticketErrorSchema,
])
export const ticketSyncRequestedOutputSchema = z.union([
  message('ticket.sync-requested', { projectId: identifier }),
  ticketErrorSchema,
])

export async function readActive(
  call: Call,
  page: number,
): Promise<z.infer<typeof ticketIndexedOutputSchema>> {
  const target = await writableConnection(call)
  if (!target.ok) return target.error
  const { provider, scope } = target
  const pageSize = TICKET_PAGE_SIZE
  const read = readActiveTickets(call.index.database, { provider, scope, page, pageSize })
  const { requestId, projectId } = call
  return {
    version: 1,
    type: 'ticket.indexed',
    requestId,
    projectId,
    scope,
    page,
    pageSize,
    ...read,
  }
}

export async function requestSync(
  call: Call,
): Promise<z.infer<typeof ticketSyncRequestedOutputSchema>> {
  const target = await writableConnection(call)
  if (!target.ok) return target.error
  const { provider, scope, accountId } = target
  call.index.requestSync({ provider, scope, accountId })
  const { requestId, projectId } = call
  return { version: 1, type: 'ticket.sync-requested', requestId, projectId }
}
