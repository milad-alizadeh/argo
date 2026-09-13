// Every Ticket request the cockpit sends. Each names the Project it asks about.
import type {
  TicketConnectRequest,
  TicketDiscoverRequest,
  TicketListRequest,
  TicketUpdateRequest,
} from '@/core/tickets/contract'
import { nextRequestId } from '../../../lib/requests'

export const projectRequest = <const Type extends string>(type: Type, projectId: string) => ({
  version: 1 as const,
  type,
  requestId: nextRequestId(),
  projectId,
})

export const connectSourceRequest = (
  projectId: string,
  target: { accountId: string; scope: string },
): TicketConnectRequest => ({ ...projectRequest('ticket.connect', projectId), ...target })

export const listRequest = (
  projectId: string,
  query: string,
  cursor: string | null,
): TicketListRequest => ({ ...projectRequest('ticket.list', projectId), query, cursor })

export const discoverRequest = (projectId: string, accountId: string): TicketDiscoverRequest => ({
  ...projectRequest('ticket.discover', projectId),
  accountId,
})

export const updateRequest = (
  projectId: string,
  change: { key: string; statusId: string },
): TicketUpdateRequest => ({ ...projectRequest('ticket.update', projectId), ...change })
