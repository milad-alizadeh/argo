import { ticketError } from '@/domains/tickets/api/errors'
import type { Call } from '../read-as'
import { writableTarget } from '../ticket-connection'

// The change is committed by the operation supervisor; the reply announces only what it committed.
export async function updateStatus(call: Call, change: { key: string; statusId: string }) {
  const { requestId, projectId } = call
  const target = await writableTarget(call)
  if (!target.ok) return target.error
  const { accountId, provider, scope } = target
  const outcome = await call.index.changeStatus({
    provider,
    scope,
    accountId,
    operation: 'status',
    ...change,
  })
  if (outcome.type !== 'committed' || outcome.confirmed.operation !== 'status') {
    return ticketError(
      outcome.type === 'committed' ? 'invalid-response' : outcome.failure,
      requestId,
    )
  }
  const { key } = change
  const { status } = outcome.confirmed
  return { version: 1, type: 'ticket.updated', requestId, projectId, key, status }
}
