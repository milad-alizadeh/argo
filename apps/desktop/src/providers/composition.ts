// The application chooses concrete provider adapters here. Domain modules receive the resulting
// capability map through composition and never select GitHub or Linear implementations themselves.
import type { Provider } from '@/domains/accounts/contract/contract'
import type { AccountProvider } from '@/domains/accounts/main/providers'
import type { TicketSource } from '@/domains/tickets/main/sources'
import { githubAccounts } from '@/providers/github/account-provider'
import { githubTickets } from '@/providers/github/ticket-source'
import { linearAccounts } from '@/providers/linear/account-provider'
import { linearTickets } from '@/providers/linear/ticket-source'

export const accountProviders: Record<Provider, AccountProvider> = {
  github: githubAccounts,
  linear: linearAccounts,
}

export const ticketSources: Record<Provider, TicketSource> = {
  github: githubTickets,
  linear: linearTickets,
}
