import type { Provider } from '@/domains/accounts/contract/contract'
import type { AccountProvider } from '@/domains/accounts/main/providers'
import type { TicketSource } from '@/domains/tickets/main/sources'
import type { PullRequestSource } from '@/providers/pull-request-source'

// What one provider does for the main process: sign an Account in, read and write its Tickets, and,
// for a code host, list the pull requests a new worktree can start from.
export type ProviderRegistration<Id extends Provider = Provider> = {
  provider: Id
  accounts: AccountProvider
  tickets: TicketSource
  pullRequests: PullRequestSource | null
}
