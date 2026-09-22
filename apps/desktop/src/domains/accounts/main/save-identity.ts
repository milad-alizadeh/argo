// A granted sign-in becomes an Account keyed by the provider's own stable id. The same identity
// signing in again renews that Account's grant rather than adding a second one, and two identities
// are never merged, whatever their logins (ADR-0018).

import {
  type AccountError,
  type AccountListed,
  accountError,
  type Provider,
} from '@/domains/accounts/contract/contract'
import type { AccountAccess } from '@/domains/accounts/main/access'
import { updateAccounts } from '@/domains/accounts/main/listing'
import type { SignedIn } from '@/domains/accounts/main/providers'
import { type AccountRecord, accountId } from '@/domains/accounts/main/registry'

export type SavedIdentity =
  | { type: 'account.saved'; listed: AccountListed; outcome: 'added' | 'renewed' }
  | AccountError

export async function saveIdentity(
  access: AccountAccess,
  requestId: string,
  signedIn: SignedIn & { provider: Provider },
): Promise<SavedIdentity> {
  const { identity, grant, provider } = signedIn
  const id = accountId(provider, identity.providerAccountId)
  let outcome: 'added' | 'renewed' = 'added'
  const reply = await updateAccounts(access, requestId, async (registry) => {
    const known = registry.accounts.find((account) => account.id === id)
    outcome = known ? 'renewed' : 'added'
    if (!(await access.grants.save(id, grant)))
      return accountError('storage-not-written', requestId)
    // The login is refreshed on every sign-in: it is a display attribute people rename.
    const record: AccountRecord = {
      ...known,
      id,
      provider,
      providerAccountId: identity.providerAccountId,
      login: identity.login,
      workspace: identity.workspace,
      scopes: grant.scopes,
      state: 'connected',
    }
    const accounts = known
      ? registry.accounts.map((account) => (account.id === id ? record : account))
      : [...registry.accounts, record]
    return { ...registry, accounts, noticeDismissed: true }
  })
  if (reply.type === 'account.error') return reply
  return { type: 'account.saved', listed: reply, outcome }
}
