import type { Provider } from '@/domains/accounts/contract/contract'
import type { AccountProvider } from '@/domains/accounts/main/providers'
import type { TicketSource } from '@/domains/tickets/main/sources'

// What one provider does for the main process: sign an Account in, and read and write its Tickets.
export type ProviderRegistration<Id extends Provider = Provider> = {
  provider: Id
  accounts: AccountProvider
  tickets: TicketSource
}
