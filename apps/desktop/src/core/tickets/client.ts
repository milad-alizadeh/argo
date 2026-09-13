// The renderer's Ticket operations, each reply parsed and matched to its request and Project
// before a component sees it.
import { requestIdentifier } from '../../boundary'
import { createSender } from '../contract/messages'
import {
  isTicketConnectedReply,
  isTicketDiscoverReply,
  isTicketListReply,
  isTicketUpdateReply,
  type TicketConnectedReply,
  type TicketConnectionRequest,
  type TicketConnectRequest,
  type TicketDisconnectRequest,
  type TicketDiscoverReply,
  type TicketDiscoverRequest,
  type TicketError,
  type TicketListReply,
  type TicketListRequest,
  type TicketUpdateReply,
  type TicketUpdateRequest,
  ticketError,
} from './contract'

export type TicketClient = {
  readConnection(request: TicketConnectionRequest): Promise<TicketConnectedReply>
  connectSource(request: TicketConnectRequest): Promise<TicketConnectedReply>
  disconnectSource(request: TicketDisconnectRequest): Promise<TicketConnectedReply>
  listTickets(request: TicketListRequest): Promise<TicketListReply>
  discoverSources(request: TicketDiscoverRequest): Promise<TicketDiscoverReply>
  updateStatus(request: TicketUpdateRequest): Promise<TicketUpdateReply>
}

export function createTicketClient(invoke: (request: unknown) => Promise<unknown>): TicketClient {
  const send = createSender<TicketError>(invoke, ticketError)
  // A reply about another Project is refused, not drawn on this one.
  async function forProject<
    T extends TicketConnectedReply | TicketListReply | TicketDiscoverReply | TicketUpdateReply,
  >(
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
    connectSource: (request) => forProject(request, isTicketConnectedReply),
    disconnectSource: (request) => forProject(request, isTicketConnectedReply),
    listTickets: (request) => forProject(request, isTicketListReply),
    discoverSources: (request) => forProject(request, isTicketDiscoverReply),
    updateStatus: (request) => forProject(request, isTicketUpdateReply),
  }
}
