// The renderer's Ticket operations, each reply parsed and matched to its request and Project
// before a component sees it.
import { requestIdentifier } from '../../boundary'
import { createSender } from '../contract/messages'
import {
  isTicketConnectedReply,
  isTicketDiscoverReply,
  isTicketListReply,
  type TicketConnectedReply,
  type TicketConnectionRequest,
  type TicketConnectRequest,
  type TicketDisconnectRequest,
  type TicketDiscoverReply,
  type TicketDiscoverRequest,
  type TicketError,
  type TicketListReply,
  type TicketListRequest,
  ticketError,
} from './contract'

export type TicketClient = {
  readConnection(request: TicketConnectionRequest): Promise<TicketConnectedReply>
  connectRepository(request: TicketConnectRequest): Promise<TicketConnectedReply>
  disconnectRepository(request: TicketDisconnectRequest): Promise<TicketConnectedReply>
  listTickets(request: TicketListRequest): Promise<TicketListReply>
  discoverRepositories(request: TicketDiscoverRequest): Promise<TicketDiscoverReply>
}

export function createTicketClient(invoke: (request: unknown) => Promise<unknown>): TicketClient {
  const send = createSender<TicketError>(invoke, ticketError)
  // A reply about another Project is refused, not drawn on this one.
  async function forProject<T extends TicketConnectedReply | TicketListReply | TicketDiscoverReply>(
    request: { projectId: string },
    accept: (value: unknown) => value is T,
  ): Promise<T | TicketError> {
    const reply = await send(request, accept)
    if (reply.type !== 'ticket.error' && reply.projectId !== request.projectId) {
      return ticketError('invalid-response', requestIdentifier(request))
    }
    return reply
  }
  return {
    readConnection: (request) => forProject(request, isTicketConnectedReply),
    connectRepository: (request) => forProject(request, isTicketConnectedReply),
    disconnectRepository: (request) => forProject(request, isTicketConnectedReply),
    listTickets: (request) => forProject(request, isTicketListReply),
    discoverRepositories: (request) => forProject(request, isTicketDiscoverReply),
  }
}
