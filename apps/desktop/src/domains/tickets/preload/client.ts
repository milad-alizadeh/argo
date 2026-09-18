import { requestIdentifier } from '../../../boundary'
import { createDomainClient } from '../../../core/contract/domain'
import {
  type TicketConnectedReply,
  type TicketDiscoverReply,
  type TicketListReply,
  type TicketPriority,
  type TicketPriorityReply,
  type TicketUpdateReply,
  ticketError,
} from '../contract/contract'
import { TICKET_OPERATIONS } from '../contract/operations'

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
    discoverSources: (request) => forProject(request, client.discover(request)),
    updateStatus: (request) => forProject(request, client.update(request)),
    updatePriority: (request) => forProject(request, client.priority(request)),
  }
}
