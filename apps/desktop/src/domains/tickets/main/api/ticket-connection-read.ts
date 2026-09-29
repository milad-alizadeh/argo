import { type TicketConnectedReply, ticketError } from '@/domains/tickets/contract/contract'
import type { Call } from '../read-as'
import { connected, findConnection, projectExists } from './ticket-connection'

export async function readConnection(call: Call): Promise<TicketConnectedReply> {
  if (!(await projectExists(call))) return ticketError('missing-project', call.requestId)
  const found = await findConnection(call)
  return found.ok ? connected(call, found.connection) : found.error
}
