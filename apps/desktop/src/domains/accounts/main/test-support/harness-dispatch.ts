// The harness's stringly-typed test-facing dispatch, kept separate so `harness.ts` stays about
// booting the fixture rather than routing test call sites onto the typed clients.

import type { ACCOUNT_OPERATIONS } from '@/domains/accounts/contract/operations'
import type { TicketPriority } from '@/domains/tickets/contract/contract'
import type { TICKET_OPERATIONS } from '@/domains/tickets/contract/operations'
import type { createDomainClient } from '@/shared/ipc/client'
import { PROJECT_ID } from './harness-fixtures'

export type AccountDispatchClient = ReturnType<typeof createDomainClient<typeof ACCOUNT_OPERATIONS>>
export type TicketDispatchClient = ReturnType<typeof createDomainClient<typeof TICKET_OPERATIONS>>

export async function dispatchAccount(
  accountClient: AccountDispatchClient,
  type: string,
  fields: Record<string, string>,
): Promise<unknown> {
  switch (type) {
    case 'account.list':
      return accountClient.list()
    case 'account.connect':
      return accountClient.connect({ provider: fields.provider as 'github' | 'linear' })
    case 'account.verify':
      return accountClient.verify()
    case 'account.await':
      return accountClient.await()
    case 'account.cancel':
      return accountClient.cancel()
    case 'account.dismiss-notice':
      return accountClient.dismissNotice()
    case 'account.disconnect':
      return accountClient.disconnect({ accountId: String(fields.accountId) })
    default:
      throw new Error(`unknown account operation ${type}`)
  }
}

export async function dispatchTicket(
  tickets: TicketDispatchClient,
  type: string,
  fields: Record<string, unknown>,
): Promise<unknown> {
  const projectId = typeof fields.projectId === 'string' ? fields.projectId : PROJECT_ID
  switch (type) {
    case 'ticket.connection':
      return tickets.connection({ projectId })
    case 'ticket.connect':
      return tickets.connect({
        projectId,
        accountId: String(fields.accountId),
        scope: String(fields.scope),
      })
    case 'ticket.disconnect':
      return tickets.disconnect({ projectId })
    case 'ticket.discover':
      return tickets.discover({ projectId, accountId: String(fields.accountId) })
    case 'ticket.list':
      return tickets.list({
        projectId,
        query: typeof fields.query === 'string' ? fields.query : '',
        cursor: typeof fields.cursor === 'string' ? fields.cursor : null,
      })
    case 'ticket.update':
      return tickets.update({
        projectId,
        key: String(fields.key),
        statusId: String(fields.statusId),
      })
    case 'ticket.priority':
      return tickets.priority({
        projectId,
        key: String(fields.key),
        priorityLevel:
          typeof fields.priorityLevel === 'number'
            ? (fields.priorityLevel as TicketPriority['level'])
            : null,
      })
    default:
      throw new Error(`unknown ticket operation ${type}`)
  }
}
