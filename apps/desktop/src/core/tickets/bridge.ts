// The Ticket channel's main-process end. The renderer names a Project; the Binding, the Account's
// grant and every GitHub call are resolved here.
import type { BrowserWindow } from 'electron'
import { requestIdentifier } from '../../boundary'
import type { AccountAccess } from '../accounts/access'
import { createRouter } from '../contract/messages'
import { isTrustedRendererFrame } from '../security/is-trusted-renderer-frame'
import {
  isTicketBindingRequest,
  isTicketBindRequest,
  isTicketListRequest,
  isTicketUnbindRequest,
  TICKET_CHANNEL,
  ticketError,
} from './contract'
import { bind, listTickets, readBinding, unbind } from './service'

type Call = { access: AccountAccess; requestId: string; projectId: string }

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
  'ticket.binding': handler(isTicketBindingRequest, readBinding),
  'ticket.bind': handler(isTicketBindRequest, (call, { accountId, scope }) =>
    bind(call, { accountId, scope }),
  ),
  'ticket.unbind': handler(isTicketUnbindRequest, unbind),
  'ticket.list': handler(isTicketListRequest, listTickets),
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
