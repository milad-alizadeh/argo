import type { TicketPriorityChoicesReply } from '@/domains/tickets/contract/contract'
import { type Call, readAs } from '../read-as'
import { writableConnection } from './ticket-connection'

// The levels come from the provider on every read; the renderer keeps them until a Project changes.
export async function readPriorityChoices(call: Call): Promise<TicketPriorityChoicesReply> {
  const target = await writableConnection(call)
  if (!target.ok) return target.error
  const read = await readAs(call, target.accountId, (source, reader) =>
    source.readPriorityChoices(reader),
  )
  if (!read.ok) return read.error
  const { requestId, projectId } = call
  return {
    version: 1,
    type: 'ticket.priorityChoices',
    requestId,
    projectId,
    choices: [...read.value],
  }
}
