import { type AccountListReply, PROVIDERS } from '../src/domains/accounts/contract/contract'
import type { TicketConnectedReply } from '../src/domains/tickets/api/messages'

type StorybookTicketsHost = {
  accountList: () => Promise<AccountListReply>
  readConnection: (request: { projectId: string }) => Promise<TicketConnectedReply>
}

// No Account and no Connection: a story that reaches the Tickets screen draws its first-run screen.
export const ticketsHost: StorybookTicketsHost = {
  accountList: () =>
    Promise.resolve({
      version: 1,
      type: 'account.listed',
      requestId: 'story',
      accounts: [],
      notice: false,
      providers: [...PROVIDERS],
    }),
  readConnection: (request) =>
    Promise.resolve({
      version: 1,
      type: 'ticket.connected',
      requestId: 'story',
      projectId: request.projectId,
      connection: null,
    }),
}
