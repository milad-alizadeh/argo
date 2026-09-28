import type { Provider } from '@/domains/accounts/contract/contract'
import { i18n } from '@/platform/renderer/i18n/i18n'
import { githubPresentation } from '@/providers/github/presentation'
import { linearPresentation } from '@/providers/linear/presentation'
import type { ProviderPresentation } from '@/providers/presentation'

export const PROVIDER_PRESENTATIONS: Record<Provider, ProviderPresentation> = {
  github: githubPresentation,
  linear: linearPresentation,
}

type ProviderText = {
  name: string
  // What a Connection binds to, in lower case: a GitHub repository, a Linear team.
  scope: { one: string; many: string }
  requesting: string
  connect: string
  // What the person does on the provider's page to finish signing in, and the control that opens it.
  challenge: string
  open: string
  // The Tickets as the provider calls them, for the sentences that describe a Connection.
  items: string
  scopePlaceholder: string
  noScopes: (login: string) => string
  // What the Detail says when the provider serves no dependency facts for a Ticket.
  noDependencies: string
  statusNoun: string
}

export type ProviderView = ProviderPresentation & ProviderText

// Read on call rather than built once at import, so it answers in the current language. `i18n.t`
// subscribes to nothing, so a caller that must redraw on a language change holds `useTranslation`.
export function providerPresentation(provider: Provider): ProviderView {
  const presentation = PROVIDER_PRESENTATIONS[provider]
  return {
    ...presentation,
    name: i18n.t(`providers:${provider}.name`),
    scope: {
      one: i18n.t(`providers:${provider}.scopeOne`),
      many: i18n.t(`providers:${provider}.scopeMany`),
    },
    requesting: i18n.t(`providers:${provider}.requesting`),
    connect: i18n.t(`providers:${provider}.connect`),
    challenge: i18n.t(`providers:${provider}.challenge`),
    open: i18n.t(`providers:${provider}.open`),
    items: i18n.t(`providers:${provider}.items`),
    scopePlaceholder: i18n.t(`providers:${provider}.scopePlaceholder`),
    noScopes: (login) => i18n.t(`providers:${provider}.noScopes`, { login }),
    noDependencies: i18n.t(`providers:${provider}.noDependencies`),
    statusNoun: i18n.t(`tickets:status.noun.${presentation.statusTerm}`),
  }
}
