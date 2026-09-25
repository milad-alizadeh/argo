import { type AccountListReply, PROVIDERS } from '../src/domains/accounts/contract/contract'
import type {
  TicketConnectedReply,
  TicketConnectionRequest,
} from '../src/domains/tickets/contract/contract'

type StorybookTicketsHost = {
  listAccounts: () => Promise<AccountListReply>
  readConnection: (request: TicketConnectionRequest) => Promise<TicketConnectedReply>
}

// No Account and no Connection: a story that reaches the Tickets screen draws its first-run screen.
export const ticketsHost: StorybookTicketsHost = {
  listAccounts: () =>
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
