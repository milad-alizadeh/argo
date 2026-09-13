// How each provider reads on screen. A view that differs by provider looks it up here, so a new
// provider is one entry and a provider's own concept is one field on its entry.
import type { Provider } from '@/core/accounts/contract'

export type ProviderPresentation = {
  name: string
  // What a Connection binds to, in lower case: a GitHub repository, a Linear team.
  scope: { one: string; many: string }
  requesting: string
}

export const PROVIDER_PRESENTATION: Record<Provider, ProviderPresentation> = {
  github: {
    name: 'GitHub',
    scope: { one: 'repository', many: 'repositories' },
    requesting: 'Asking GitHub for a code…',
  },
  linear: {
    name: 'Linear',
    scope: { one: 'team', many: 'teams' },
    requesting: 'Opening Linear…',
  },
}

export const capitalized = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)
