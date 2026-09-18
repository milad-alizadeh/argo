import { PROVIDERS } from '../src/domains/accounts/contract/contract'
import type { AccountClient } from '../src/domains/accounts/preload/client'
import type { TicketClient } from '../src/domains/tickets/preload/client'

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
