import { type TicketPriorityReply, ticketError } from '@/domains/tickets/contract/contract'
import type { PriorityChange } from '@/domains/tickets/contract/ticket'
import { type Call, readAs } from '../read-as'
import { accountRefusal, writableConnection } from './ticket-connection'

// The same path as a status change: the priority in the reply is the one the provider confirmed.
export async function updatePriority(
  call: Call,
  change: Omit<PriorityChange, 'scope'>,
): Promise<TicketPriorityReply> {
  const { requestId, projectId } = call
  const target = await writableConnection(call)
  if (!target.ok) return target.error
  const { accountId, provider, scope } = target
  // The provider is asked for its levels, so a level it no longer offers is refused before an intent.
  const offered = await readAs(call, accountId, (source, reader) =>
    source.readPriorityChoices(reader),
  )
  if (!offered.ok) return offered.error
  if (
    change.priorityLevel !== null &&
    !offered.value.some(({ level }) => level === change.priorityLevel)
  ) {
    return ticketError('ticket-not-writable', requestId)
  }
  const refusal = await accountRefusal(call, target)
  if (refusal) return refusal
  const outcome = await call.index.changePriority({
    provider,
    scope,
    accountId,
    operation: 'priority',
    ...change,
  })
  if (outcome.type !== 'committed' || outcome.confirmed.operation !== 'priority') {
    return ticketError(
      outcome.type === 'committed' ? 'invalid-response' : outcome.failure,
      requestId,
    )
  }
  const { key } = change
  const { priority } = outcome.confirmed
  return { version: 1, type: 'ticket.prioritized', requestId, projectId, key, priority }
}
