// The Ticket screen's reads from SQLite and its requests for a fresh provider scan.
import { z } from 'zod'
import { ticketSearchStateSchema } from '@/database/ticket-search/validation'
import { ticketSyncStateSchema } from '@/database/ticket-sync/validation'
import { TICKET_PAGE_SIZE, ticketErrorSchema } from '@/domains/tickets/contract/contract'
import { ticket, ticketStatus } from '@/domains/tickets/contract/ticket'
import { identifier, message } from '@/shared/messages'
import { readActiveTickets, readSearchedTickets } from './database/ticket-queries'
import type { Call } from './read-as'
import { writableConnection } from './service'

// One numbered page of Tickets saved in SQLite.
const savedPage = {
  projectId: identifier,
  scope: identifier,
  tickets: z.array(ticket),
  statuses: z.array(ticketStatus),
  page: z.int().nonnegative(),
  pageSize: z.int().positive(),
  total: z.int().nonnegative(),
}

// The active Tickets, and the scan state behind them.
export const ticketIndexedOutputSchema = z.union([
  message('ticket.indexed', { ...savedPage, sync: ticketSyncStateSchema }),
  ticketErrorSchema,
])
// The Tickets saved for a query, and the provider search behind them.
export const ticketSearchedOutputSchema = z.union([
  message('ticket.searched', { ...savedPage, query: z.string(), search: ticketSearchStateSchema }),
  ticketErrorSchema,
])
export const ticketSearchRequestedOutputSchema = z.union([
  message('ticket.search-requested', { projectId: identifier }),
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

export async function readSearch(
  call: Call,
  { query, page }: { query: string; page: number },
): Promise<z.infer<typeof ticketSearchedOutputSchema>> {
  const target = await writableConnection(call)
  if (!target.ok) return target.error
  const { provider, scope } = target
  const pageSize = TICKET_PAGE_SIZE
  const read = readSearchedTickets(call.index.database, { provider, scope, query, page, pageSize })
  const { requestId, projectId } = call
  return {
    version: 1,
    type: 'ticket.searched',
    requestId,
    projectId,
    scope,
    query,
    page,
    pageSize,
    ...read,
  }
}

// Asks the provider for matches the saved Tickets may lack; they arrive as a committed change.
export async function requestSearch(
  call: Call,
  query: string,
): Promise<z.infer<typeof ticketSearchRequestedOutputSchema>> {
  const target = await writableConnection(call)
  if (!target.ok) return target.error
  const { provider, scope, accountId } = target
  call.index.send({ type: 'Search', request: { provider, scope, accountId, query } })
  const { requestId, projectId } = call
  return { version: 1, type: 'ticket.search-requested', requestId, projectId }
}

export async function requestSync(
  call: Call,
): Promise<z.infer<typeof ticketSyncRequestedOutputSchema>> {
  const target = await writableConnection(call)
  if (!target.ok) return target.error
  const { provider, scope, accountId } = target
  call.index.send({ type: 'Sync', request: { provider, scope, accountId } })
  const { requestId, projectId } = call
  return { version: 1, type: 'ticket.sync-requested', requestId, projectId }
}

// A view showing the Project's Tickets, until the returned stop. The request ID names the view.
export function watchTickets(call: Call): () => void {
  let stopped = false
  void writableConnection(call).then(
    (target) => {
      if (stopped) return
      // The screen shows this refusal from its own reads; the watch only says why it does not poll.
      if (!target.ok) {
        console.warn(`A Ticket watch was refused: ${target.error.code}.`)
        return
      }
      const { provider, scope, accountId } = target
      call.index.send({
        type: 'Watch',
        watcherId: call.requestId,
        request: { provider, scope, accountId },
      })
    },
    (error: unknown) => console.warn('The watched Ticket Connection could not be read.', error),
  )
  return () => {
    stopped = true
    call.index.send({ type: 'Unwatch', watcherId: call.requestId })
  }
}
