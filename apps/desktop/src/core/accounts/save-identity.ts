// A granted sign-in becomes an Account keyed by GitHub's numeric id. The same identity signing in
// again renews that Account's grant rather than adding a second one, and two identities are never
// merged, whatever their logins (ADR-0018).
import type { GitHubIdentity, Grant } from '../../providers/github/device-flow'
import type { AccountAccess } from './access'
import { type AccountError, type AccountListed, accountError } from './contract'
import { updateAccounts } from './listing'
import { type AccountRecord, accountId } from './registry'

export type SavedIdentity =
  | { type: 'account.saved'; listed: AccountListed; outcome: 'added' | 'renewed' }
  | AccountError

export async function saveIdentity(
  access: AccountAccess,
  requestId: string,
  signedIn: { identity: GitHubIdentity; grant: Grant },
): Promise<SavedIdentity> {
  const { identity, grant } = signedIn
  const id = accountId(identity.providerAccountId)
  let outcome: 'added' | 'renewed' = 'added'
  const reply = await updateAccounts(access, requestId, async (registry) => {
    const known = registry.accounts.find((account) => account.id === id)
    outcome = known ? 'renewed' : 'added'
    if (!(await access.grants.save(id, grant)))
      return accountError('storage-not-written', requestId)
    // The login is refreshed on every sign-in: it is a display attribute GitHub lets people rename.
    const record: AccountRecord = {
      ...known,
      id,
      provider: 'github',
      providerAccountId: identity.providerAccountId,
      login: identity.login,
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
