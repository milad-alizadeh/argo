// A Ticket's priority write, split out of service.ts to keep that file under its line cap.
import type { TicketPriorityReply } from './contract'
import { type Call, readAs } from './read-as'
import { writeTicketField } from './service'
import type { PriorityChange } from './ticket'

export async function updatePriority(
  call: Call,
  change: Omit<PriorityChange, 'scope'>,
): Promise<TicketPriorityReply> {
  const { requestId, projectId } = call
  const written = await writeTicketField(call, (accountId, scope) =>
    readAs(call, accountId, (source, reader) => source.updatePriority(reader, { scope, ...change })),
  )
  if (!written.ok) return written.error
  const { key } = change
  return {
    version: 1,
    type: 'ticket.prioritized',
    requestId,
    projectId,
    key,
    priority: written.value,
  }
}
