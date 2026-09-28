// What each provider an Account can belong to does for the Account core: start a sign-in, and renew
// a grant that lapses. Each provider registers it once under `src/providers/<provider>/`.

import {
  type AccountErrorCode,
  PROVIDERS,
  type Provider,
} from '@/domains/accounts/contract/contract'
import type { ProviderEndpoints } from '@/providers/endpoints'
import type { Grant, Identity, TokenReply } from '@/providers/grant'

export type SignedIn = { identity: Identity; grant: Grant }
export type SignInEnd = { ok: true; signedIn: SignedIn } | { ok: false; code: AccountErrorCode }

// A sign-in under way. The page it opens is built or checked in main, never named by the renderer.
export type SignInStart = {
  challenge:
    | { kind: 'device-code'; userCode: string; verificationUri: string }
    | { kind: 'browser-consent' }
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

// The Account half of each provider's registration.
export type AccountProviders = Record<Provider, { accounts: AccountProvider }>

export const availableProviders = (
  providers: AccountProviders,
  endpoints: ProviderEndpoints,
): Provider[] => PROVIDERS.filter((provider) => providers[provider].accounts.available(endpoints))
