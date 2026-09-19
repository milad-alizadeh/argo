// What each provider an Account can belong to does for the Account core: start a sign-in, and renew
// a grant that lapses. A new provider is one module under `src/providers/` and one line here.

import {
  type AccountErrorCode,
  PROVIDERS,
  type Provider,
} from '@/domains/accounts/contract/contract'
import type { ProviderEndpoints } from '@/providers/endpoints'
import { githubAccounts } from '@/providers/github/account-provider'
import type { Grant, Identity, TokenReply } from '@/providers/grant'
import { linearAccounts } from '@/providers/linear/account-provider'

export type SignedIn = { identity: Identity; grant: Grant }
export type SignInEnd = { ok: true; signedIn: SignedIn } | { ok: false; code: AccountErrorCode }

// A sign-in under way. The page it opens is built or checked in main, never named by the renderer.
export type SignInStart = {
  challenge:
    | { provider: 'github'; userCode: string; verificationUri: string }
    | { provider: 'linear' }
  url: string
  expiresAt: number
  finish(): Promise<SignInEnd>
  // Settled once nothing of the sign-in is left running, a claimed port included.
  cancel(): Promise<void>
}

export type AccountProvider = {
  available(endpoints: ProviderEndpoints): boolean
  start(endpoints: ProviderEndpoints): Promise<SignInStart | AccountErrorCode>
  // Null for a provider whose grants do not lapse.
  renew: ((endpoints: ProviderEndpoints, refreshToken: string) => Promise<TokenReply>) | null
}

export const ACCOUNT_PROVIDERS: Record<Provider, AccountProvider> = {
  github: githubAccounts,
  linear: linearAccounts,
}

export const availableProviders = (endpoints: ProviderEndpoints): Provider[] =>
  PROVIDERS.filter((provider) => ACCOUNT_PROVIDERS[provider].available(endpoints))
