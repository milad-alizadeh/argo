// The harness's stringly-typed test-facing dispatch, kept separate so `harness.ts` stays about
// booting the fixture rather than routing test call sites onto the typed clients.
import type { TicketClient } from '../tickets/client'
import type { AccountClient } from './client'
import { PROJECT_ID } from './harness-fixtures'

export async function dispatchAccount(
  accountClient: AccountClient,
  type: string,
  fields: Record<string, string>,
): Promise<unknown> {
  switch (type) {
    case 'account.list':
      return accountClient.listAccounts()
    case 'account.connect':
      return accountClient.connectAccount({ provider: fields.provider as 'github' | 'linear' })
    case 'account.verify':
      return accountClient.verifyAccount()
    case 'account.await':
      return accountClient.awaitAccount()
    case 'account.cancel':
      return accountClient.cancelAccount()
    case 'account.dismiss-notice':
      return accountClient.dismissAccountNotice()
    case 'account.disconnect':
      return accountClient.disconnectAccount({ accountId: String(fields.accountId) })
    default:
      throw new Error(`unknown account operation ${type}`)
  }
}

export async function dispatchTicket(
  tickets: TicketClient,
  type: string,
  fields: Record<string, unknown>,
): Promise<unknown> {
  const projectId = typeof fields.projectId === 'string' ? fields.projectId : PROJECT_ID
  switch (type) {
    case 'ticket.connection':
      return tickets.readConnection({ projectId })
    case 'ticket.connect':
      return tickets.connectSource({
        projectId,
        accountId: String(fields.accountId),
        scope: String(fields.scope),
      })
    case 'ticket.disconnect':
      return tickets.disconnectSource({ projectId })
    case 'ticket.discover':
      return tickets.discoverSources({ projectId, accountId: String(fields.accountId) })
    case 'ticket.list':
      return tickets.listTickets({
        projectId,
        query: typeof fields.query === 'string' ? fields.query : '',
        cursor: typeof fields.cursor === 'string' ? fields.cursor : null,
      })
    case 'ticket.update':
      return tickets.updateStatus({
        projectId,
        key: String(fields.key),
        statusId: String(fields.statusId),
      })
    default:
      throw new Error(`unknown ticket operation ${type}`)
  }
}
