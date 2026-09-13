// The Ticket channel's main-process end. The renderer names a Project; the Connection, the Account's
// grant and every provider call are resolved here.
import type { BrowserWindow } from 'electron'
import { requestIdentifier } from '../../boundary'
import type { AccountAccess } from '../accounts/access'
import { createRouter } from '../contract/messages'
import { isTrustedRendererFrame } from '../security/is-trusted-renderer-frame'
import {
  isTicketConnectionRequest,
  isTicketConnectRequest,
  isTicketDisconnectRequest,
  isTicketDiscoverRequest,
  isTicketListRequest,
  TICKET_CHANNEL,
  ticketError,
} from './contract'
import type { Call } from './read-as'
import {
  connectSource,
  disconnectSource,
  discoverSources,
  listTickets,
  readConnection,
} from './service'

// Each handler validates its own request and hands the service a call it can trust.
const handler =
  <T extends { requestId: string; projectId: string }>(
    accept: (request: unknown) => request is T,
    answer: (call: Call, request: T) => Promise<unknown>,
  ) =>
  (request: unknown, access: AccountAccess) =>
    accept(request)
      ? answer({ access, requestId: request.requestId, projectId: request.projectId }, request)
      : ticketError('invalid-request', requestIdentifier(request))

const HANDLERS = {
  'ticket.connection': handler(isTicketConnectionRequest, readConnection),
  'ticket.connect': handler(isTicketConnectRequest, (call, { accountId, scope }) =>
    connectSource(call, { accountId, scope }),
  ),
  'ticket.disconnect': handler(isTicketDisconnectRequest, disconnectSource),
  'ticket.discover': handler(isTicketDiscoverRequest, (call, { accountId }) =>
    discoverSources(call, accountId),
  ),
  'ticket.list': handler(isTicketListRequest, (call, { query, cursor }) =>
    listTickets(call, { query, cursor }),
  ),
}

export const routeTicketRequest = createRouter<AccountAccess, unknown>(HANDLERS, ticketError)

export function attachTicketBridge(
  window: BrowserWindow,
  options: { access: AccountAccess; rendererURL: string },
): void {
  window.webContents.ipc.handle(TICKET_CHANNEL, (event, request: unknown) => {
    if (!isTrustedRendererFrame(event, window, options.rendererURL)) {
      return ticketError('access-denied', requestIdentifier(request))
    }
    return routeTicketRequest(request, options.access)
  })
}
