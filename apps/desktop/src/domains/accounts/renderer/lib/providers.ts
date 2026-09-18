// How each provider reads on screen. A view that differs by provider looks it up here, so a new
// provider is one entry in the catalog and a provider's own concept is one key on that entry.
import type { Provider } from '@/domains/accounts/contract/contract'
import { i18n } from '../../../../renderer/i18n/config'

export type ProviderPresentation = {
  name: string
  // What a Connection binds to, in lower case: a GitHub repository, a Linear team.
  scope: { one: string; many: string }
  requesting: string
}

// Read on call rather than built once at import, so it answers in the current language. `i18n.t`
// subscribes to nothing, so a caller that must redraw on a language change holds `useTranslation`
// of its own. The Accounts callers do; the Tickets callers draw English literals either way until
// their own pull request moves them across (#2130).
export function providerPresentation(provider: Provider): ProviderPresentation {
  return {
    name: i18n.t(`accounts:provider.${provider}.name`),
    scope: {
      one: i18n.t(`accounts:provider.${provider}.scopeOne`),
      many: i18n.t(`accounts:provider.${provider}.scopeMany`),
    },
    requesting: i18n.t(`accounts:provider.${provider}.requesting`),
  }
}

export const capitalized = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)
