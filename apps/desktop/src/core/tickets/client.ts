import { requestIdentifier } from '../../boundary'
import { createDomainClient } from '../contract/domain'
import {
  type TicketConnectedReply,
  type TicketDiscoverReply,
  type TicketListReply,
  ticketError,
} from './contract'
import { TICKET_OPERATIONS } from './operations'

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
}

export function createTicketClient(
  invoke: (channel: string, request: unknown) => Promise<unknown>,
): TicketClient {
  const client = createDomainClient(TICKET_OPERATIONS, invoke, ticketError)

  async function forProject<T extends TicketConnectedReply | TicketListReply | TicketDiscoverReply>(
    request: { projectId: string },
    reply: Promise<T>,
  ): Promise<T> {
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
  }
}
