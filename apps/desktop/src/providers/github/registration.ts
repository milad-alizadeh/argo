import { githubAccounts } from '@/providers/github/account-provider'
import { githubTickets } from '@/providers/github/ticket-source'
import type { ProviderRegistration } from '@/providers/registration'

export const githubRegistration: ProviderRegistration<'github'> = {
  provider: 'github',
  accounts: githubAccounts,
  tickets: githubTickets,
}
