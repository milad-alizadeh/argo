// The renderer's Ticket operations, each reply parsed and matched to its request and Project
// before a component sees it.
import { requestIdentifier } from '../../boundary'
import { createSender } from '../contract/messages'
import {
  isTicketBoundReply,
  isTicketListReply,
  type TicketBindingRequest,
  type TicketBindRequest,
  type TicketBoundReply,
  type TicketError,
  type TicketListReply,
  type TicketListRequest,
  type TicketUnbindRequest,
  ticketError,
} from './contract'

export type TicketClient = {
  readBinding(request: TicketBindingRequest): Promise<TicketBoundReply>
  bindTickets(request: TicketBindRequest): Promise<TicketBoundReply>
  unbindTickets(request: TicketUnbindRequest): Promise<TicketBoundReply>
  listTickets(request: TicketListRequest): Promise<TicketListReply>
}

export function createTicketClient(invoke: (request: unknown) => Promise<unknown>): TicketClient {
  const send = createSender<TicketError>(invoke, ticketError)
  // A reply about another Project is refused, not drawn on this one.
  async function forProject<T extends TicketBoundReply | TicketListReply>(
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
    readBinding: (request) => forProject(request, isTicketBoundReply),
    bindTickets: (request) => forProject(request, isTicketBoundReply),
    unbindTickets: (request) => forProject(request, isTicketBoundReply),
    listTickets: (request) => forProject(request, isTicketListReply),
  }
}
