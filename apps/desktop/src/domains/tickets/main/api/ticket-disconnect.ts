import { ticketError } from '@/domains/tickets/api/errors'
import type { Call } from '../read-as'
import { projectExists, saveConnection } from './ticket-connection'

export async function disconnectSource(call: Call) {
  if (!(await projectExists(call))) return ticketError('missing-project', call.requestId)
  return saveConnection(call, null)
}
