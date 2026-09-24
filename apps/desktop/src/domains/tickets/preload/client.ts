import {
  type TicketConnectedReply,
  type TicketDiscoverReply,
  type TicketListReply,
  type TicketPriority,
  type TicketPriorityReply,
  type TicketReadReply,
  type TicketReadRequest,
  type TicketUpdateReply,
  ticketError,
} from '@/domains/tickets/contract/contract'
import { TICKET_OPERATIONS } from '@/domains/tickets/contract/operations'
import { createDomainClient } from '@/shared/ipc/client'
import { requestIdentifier } from '@/shared/validation'

export type TicketClient = {
  readConnection(request: { projectId: string }): Promise<TicketConnectedReply>
  connectSource(request: {
    projectId: string
    accountId: string
    scope: string
  }): Promise<TicketConnectedReply>
  disconnectSource(request: { projectId: string }): Promise<TicketConnectedReply>
  listTickets(request: {
    projectId: string
    query: string
    cursor: string | null
  }): Promise<TicketListReply>
  readTicket(request: Pick<TicketReadRequest, 'projectId' | 'key'>): Promise<TicketReadReply>
  discoverSources(request: { projectId: string; accountId: string }): Promise<TicketDiscoverReply>
  updateStatus(request: {
    projectId: string
    key: string
    statusId: string
  }): Promise<TicketUpdateReply>
  updatePriority(request: {
    projectId: string
    key: string
    priorityLevel: TicketPriority['level'] | null
  }): Promise<TicketPriorityReply>
}

export function createTicketClient(
  invoke: (channel: string, request: unknown) => Promise<unknown>,
): TicketClient {
  const client = createDomainClient(TICKET_OPERATIONS, invoke, ticketError)

  async function forProject<
    T extends
      | TicketConnectedReply
      | TicketListReply
      | TicketReadReply
      | TicketDiscoverReply
      | TicketUpdateReply
      | TicketPriorityReply,
  >(request: { projectId: string }, reply: Promise<T>): Promise<T> {
    const resolved = await reply
    if (resolved.type !== 'ticket.error' && resolved.projectId !== request.projectId) {
      return ticketError('invalid-response', requestIdentifier(resolved)) as T
    }
    return resolved
  }

  return {
    readConnection: (request) => forProject(request, client.connection(request)),
    connectSource: (request) => forProject(request, client.connect(request)),
    disconnectSource: (request) => forProject(request, client.disconnect(request)),
    listTickets: (request) => forProject(request, client.list(request)),
    readTicket: (request) => forProject(request, client.read(request)),
    discoverSources: (request) => forProject(request, client.discover(request)),
    updateStatus: (request) => forProject(request, client.update(request)),
    updatePriority: (request) => forProject(request, client.priority(request)),
  }
}
