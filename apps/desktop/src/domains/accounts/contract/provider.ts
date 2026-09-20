import { PROVIDERS, type Provider } from './contract'

// Account IDs carry the provider namespace so a durable Connection remains readable after removal.
export function providerOf(accountId: string): Provider | null {
  const prefix = accountId.slice(0, accountId.indexOf(':'))
  return PROVIDERS.find((provider) => provider === prefix) ?? null
}
