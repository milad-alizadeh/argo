import type { Provider } from '@/domains/accounts/contract/contract'
import github from '@/providers/github/locales/en.json'
import linear from '@/providers/linear/locales/en.json'

// The renderer's `providers` namespace: each provider's reader text, from its own catalog.
export const PROVIDER_CATALOG = {
  github: github.presentation,
  linear: linear.presentation,
} satisfies Record<Provider, typeof github.presentation>
