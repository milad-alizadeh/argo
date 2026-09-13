// Every Ticket request the cockpit sends. Each names the Project it asks about.
import type { TicketBindRequest } from '@/core/tickets/contract'
import { nextRequestId } from '../../../lib/requests'

export const projectRequest = <const Type extends string>(type: Type, projectId: string) => ({
  version: 1 as const,
  type,
  requestId: nextRequestId(),
  projectId,
})

export const bindRequest = (
  projectId: string,
  target: { accountId: string; scope: string },
): TicketBindRequest => ({ ...projectRequest('ticket.bind', projectId), ...target })
