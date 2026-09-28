// The one place the application chooses concrete providers. Shared Account and Ticket code looks a
// provider up here by ID and never selects a GitHub or Linear implementation itself.
import type { Provider } from '@/domains/accounts/contract/contract'
import { githubRegistration } from '@/providers/github/registration'
import { linearRegistration } from '@/providers/linear/registration'
import type { ProviderRegistration } from '@/providers/registration'

export type ProviderRegistry = { [Id in Provider]: ProviderRegistration<Id> }

export const PROVIDER_REGISTRY: ProviderRegistry = {
  github: githubRegistration,
  linear: linearRegistration,
}
