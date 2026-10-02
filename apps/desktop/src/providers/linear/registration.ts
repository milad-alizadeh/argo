import { linearAccounts } from '@/providers/linear/account-provider'
import { linearTickets } from '@/providers/linear/ticket-source'
import type { ProviderRegistration } from '@/providers/registration'

export const linearRegistration: ProviderRegistration<'linear'> = {
  provider: 'linear',
  accounts: linearAccounts,
  tickets: linearTickets,
}
