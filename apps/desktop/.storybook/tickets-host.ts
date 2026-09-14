import type { AccountClient } from '../src/core/accounts/client'
import { PROVIDERS } from '../src/core/accounts/contract'
import type { TicketClient } from '../src/core/tickets/client'

// No Account and no Connection: a story that reaches the Tickets screen draws its first-run screen.
export const ticketsHost: Pick<AccountClient, 'listAccounts'> &
  Pick<TicketClient, 'readConnection'> = {
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
