import { githubAccounts } from '@/providers/github/account-provider'
import { githubPullRequests } from '@/providers/github/pull-requests'
import { githubTickets } from '@/providers/github/ticket-source'
import type { ProviderRegistration } from '@/providers/registration'

export const githubRegistration: ProviderRegistration<'github'> = {
  provider: 'github',
  accounts: githubAccounts,
  tickets: githubTickets,
  pullRequests: githubPullRequests,
}
