import type { BrowserWindow } from 'electron'
import type { AccountAccess } from '@/domains/accounts/main/port'
import type { Provider } from '@/domains/accounts/contract/contract'
import type { ConnectionPort } from '@/domains/connections/main/port'
import { ticketError } from '@/domains/tickets/contract/contract'
import { TICKET_OPERATIONS } from '@/domains/tickets/contract/operations'
import { updatePriority } from '@/domains/tickets/main/priority-service'
import type { Call } from '@/domains/tickets/main/read-as'
import type { TicketSource } from '@/domains/tickets/main/sources'
import {
  connectSource,
  disconnectSource,
  discoverSources,
  listTickets,
  readConnection,
  updateStatus,
} from '@/domains/tickets/main/service'
import { registerDomainHandlers } from '@/platform/main/ipc/register-domain-handlers'

type TicketContext = {
  access: AccountAccess
  connections: ConnectionPort
  sources: Record<Provider, TicketSource>
}

function callFor(context: TicketContext, request: { requestId: string; projectId: string }): Call {
  return { ...context, requestId: request.requestId, projectId: request.projectId }
}

export function attachTicketBridge(
  window: BrowserWindow,
  options: {
    access: AccountAccess
    connections: ConnectionPort
    rendererURL: string
    sources: Record<Provider, TicketSource>
  },
): void {
  registerDomainHandlers({
    window,
    rendererURL: options.rendererURL,
    operations: TICKET_OPERATIONS,
    context: { access: options.access, connections: options.connections, sources: options.sources },
    handlers: {
      connection: (request, context) => readConnection(callFor(context, request)),
      connect: (request, context) =>
        connectSource(callFor(context, request), {
          accountId: request.accountId,
          scope: request.scope,
        }),
      disconnect: (request, context) => disconnectSource(callFor(context, request)),
      discover: (request, context) => discoverSources(callFor(context, request), request.accountId),
      list: (request, context) =>
        listTickets(callFor(context, request), { query: request.query, cursor: request.cursor }),
      update: (request, context) =>
        updateStatus(callFor(context, request), { key: request.key, statusId: request.statusId }),
      priority: (request, context) =>
        updatePriority(callFor(context, request), {
          key: request.key,
          priorityLevel: request.priorityLevel,
        }),
    },
    error: ticketError,
  })
}
