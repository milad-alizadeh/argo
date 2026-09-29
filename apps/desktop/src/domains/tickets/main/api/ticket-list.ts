import type { TicketListReply } from '@/domains/tickets/contract/contract'
import { type Call, readAs } from '../read-as'
import { writableConnection } from './ticket-connection'

export async function listTickets(
  call: Call,
  request: { query: string; cursor: string | null },
): Promise<TicketListReply> {
  const { requestId, projectId } = call
  const target = await writableConnection(call)
  if (!target.ok) return target.error
  const { accountId, scope } = target
  const read = await readAs(call, accountId, (source, reader) =>
    source.page(reader, { scope, ...request }),
  )
  if (!read.ok) return read.error
  return {
    version: 1,
    type: 'ticket.listed',
    requestId,
    projectId,
    scope,
    ...read.value,
  }
}
