import { ticketError } from '@/domains/tickets/api/errors'
import type { PriorityChange } from '@/domains/tickets/api/ticket'
import type { Call } from '../read-as'
import { writableTarget } from './ticket-connection'

// The same path as a status change: the priority in the reply is the one the provider confirmed.
export async function updatePriority(call: Call, change: Omit<PriorityChange, 'scope'>) {
  const { requestId, projectId } = call
  const target = await writableTarget(call)
  if (!target.ok) return target.error
  const { accountId, provider, scope } = target
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
