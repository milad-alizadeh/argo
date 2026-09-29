import { type TicketConnectedReply, ticketError } from '@/domains/tickets/contract/contract'
import type { Call } from '../read-as'
import { projectExists, saveConnection } from './ticket-connection'

export async function disconnectSource(call: Call): Promise<TicketConnectedReply> {
  if (!(await projectExists(call))) return ticketError('missing-project', call.requestId)
  return saveConnection(call, null)
}
