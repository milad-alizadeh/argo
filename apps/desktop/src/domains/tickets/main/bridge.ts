import type { BrowserWindow } from 'electron'
import type { AccountAccess } from '@/domains/accounts/main/port'
import { ticketError } from '@/domains/tickets/contract/contract'
import { TICKET_OPERATIONS } from '@/domains/tickets/contract/operations'
import { updatePriority } from '@/domains/tickets/main/priority-service'
import type { Call } from '@/domains/tickets/main/read-as'
import {
  connectSource,
  disconnectSource,
  discoverSources,
  listTickets,
  readConnection,
  updateStatus,
} from '@/domains/tickets/main/service'
import { registerDomainHandlers } from '@/platform/main/ipc/register-domain-handlers'

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
