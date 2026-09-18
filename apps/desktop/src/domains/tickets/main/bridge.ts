import type { BrowserWindow } from 'electron'
import { registerDomainHandlers } from '../../../core/contract/domain'
import type { AccountAccess } from '../../accounts/main/access'
import { ticketError } from '../contract/contract'
import { TICKET_OPERATIONS } from '../contract/operations'
import { updatePriority } from './priority-service'
import type { Call } from './read-as'
import {
  connectSource,
  disconnectSource,
  discoverSources,
  listTickets,
  readConnection,
  updateStatus,
} from './service'

function callFor(access: AccountAccess, request: { requestId: string; projectId: string }): Call {
  return { access, requestId: request.requestId, projectId: request.projectId }
}

export function attachTicketBridge(
  window: BrowserWindow,
  options: { access: AccountAccess; rendererURL: string },
): void {
  registerDomainHandlers({
    window,
    rendererURL: options.rendererURL,
    operations: TICKET_OPERATIONS,
    context: options.access,
    handlers: {
      connection: (request, access) => readConnection(callFor(access, request)),
      connect: (request, access) =>
        connectSource(callFor(access, request), {
          accountId: request.accountId,
          scope: request.scope,
        }),
      disconnect: (request, access) => disconnectSource(callFor(access, request)),
      discover: (request, access) => discoverSources(callFor(access, request), request.accountId),
      list: (request, access) =>
        listTickets(callFor(access, request), { query: request.query, cursor: request.cursor }),
      update: (request, access) =>
        updateStatus(callFor(access, request), { key: request.key, statusId: request.statusId }),
      priority: (request, access) =>
        updatePriority(callFor(access, request), {
          key: request.key,
          priorityLevel: request.priorityLevel,
        }),
    },
    error: ticketError,
  })
}
