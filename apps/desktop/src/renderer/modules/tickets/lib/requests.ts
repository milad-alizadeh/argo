// Every Ticket request the cockpit sends. Each names the Project it asks about.
import type { TicketConnectRequest, TicketListRequest } from '@/core/tickets/contract'
import { nextRequestId } from '../../../lib/requests'

export const projectRequest = <const Type extends string>(type: Type, projectId: string) => ({
  version: 1 as const,
  type,
  requestId: nextRequestId(),
  projectId,
})

export const connectRepositoryRequest = (
  projectId: string,
  target: { accountId: string; scope: string },
): TicketConnectRequest => ({ ...projectRequest('ticket.connect', projectId), ...target })

export const listRequest = (projectId: string, query: string, page: number): TicketListRequest => ({
  ...projectRequest('ticket.list', projectId),
  query,
  page,
})
