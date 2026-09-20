// The one way a provider call gets a token (ADR-0018). A grant near its end is renewed before it is
// sent, a refused one is renewed once and tried again, and a renewal the provider refuses leaves
// the Account expired; each Account on its own, so one lapsing never touches another.

import { type AccountAccess, markRevoked, writeState } from '@/domains/accounts/main/access'
import { type AccountRecord, readAccounts } from '@/domains/accounts/main/registry'
import type { Grant } from '@/providers/grant'

// Renewed this long before it lapses, so a token is never sent in its last minutes.
const RENEWAL_MARGIN_MILLISECONDS = 5 * 60_000

export type TokenFailure =
  | { ok: false; reason: 'storage' | 'missing-account' | 'grant-unreadable' }
  | { ok: false; reason: 'account-expired' | 'account-revoked' }
  // The provider could not be asked to renew: nothing is known about the grant, so nothing is marked.
  | { ok: false; reason: 'renewal-failed'; failure: 'rate-limited' | 'unreachable' }

export type TokenRead = { ok: true; token: string; account: AccountRecord } | TokenFailure

const due = (grant: Grant) =>
  grant.renewal !== null && grant.renewal.expiresAt - RENEWAL_MARGIN_MILLISECONDS <= Date.now()

// Inside the queue, so two calls meeting the same lapsed grant renew it once: the second finds the
// token it held already replaced and takes the new one.
function renew(access: AccountAccess, account: AccountRecord, stale: string): Promise<TokenRead> {
  return access.exclusive(async (): Promise<TokenRead> => {
    const current = await access.grants.read(account.id)
    if (!current.ok) return { ok: false, reason: 'grant-unreadable' }
    const { grant } = current
    if (grant.accessToken !== stale && !due(grant)) {
      return { ok: true, token: grant.accessToken, account }
    }
  const renewer = access.providers[account.provider].renew
    if (!renewer || !grant.renewal) {
      await writeState(access, { accountId: account.id, state: 'revoked' })
      return { ok: false, reason: 'account-revoked' }
    }
    const reply = await renewer(access.endpoints, grant.renewal.refreshToken)
    if (reply.ok) {
      if (!(await access.grants.save(account.id, reply.grant)))
        return { ok: false, reason: 'storage' }
      return { ok: true, token: reply.grant.accessToken, account }
    }
    if (reply.failure !== 'refused')
      return { ok: false, reason: 'renewal-failed', failure: reply.failure }
    await writeState(access, { accountId: account.id, state: 'expired' })
    return { ok: false, reason: 'account-expired' }
  })
}

// An expired or revoked Account is not called again until the person reconnects it.
export async function tokenFor(access: AccountAccess, accountId: string): Promise<TokenRead> {
  const registry = await readAccounts(access.paths.accounts)
  if (!registry.ok) return { ok: false, reason: 'storage' }
  const account = registry.registry.accounts.find((candidate) => candidate.id === accountId)
  if (!account) return { ok: false, reason: 'missing-account' }
  if (account.state === 'revoked') return { ok: false, reason: 'account-revoked' }
  if (account.state === 'expired') return { ok: false, reason: 'account-expired' }
  const grant = await access.grants.read(accountId)
  if (!grant.ok) return { ok: false, reason: 'grant-unreadable' }
  if (due(grant.grant)) return renew(access, account, grant.grant.accessToken)
  return { ok: true, token: grant.grant.accessToken, account }
}

export type Attempt<Reply> = {
  call: (token: string, account: AccountRecord) => Promise<Reply>
  // The provider refused the token itself, not the request.
  refused: (reply: Reply) => boolean
}

export type AccountCall<Reply> = { ok: true; reply: Reply; account: AccountRecord } | TokenFailure

// One provider call as this Account. A refusal that stands after a renewal marks it revoked.
export async function asAccount<Reply>(
  access: AccountAccess,
  accountId: string,
  attempt: Attempt<Reply>,
): Promise<AccountCall<Reply>> {
  const first = await tokenFor(access, accountId)
  if (!first.ok) return first
  const reply = await attempt.call(first.token, first.account)
  if (!attempt.refused(reply)) return { ok: true, reply, account: first.account }
  const renewed = await renew(access, first.account, first.token)
  if (!renewed.ok) return renewed
  const again = await attempt.call(renewed.token, renewed.account)
  if (!attempt.refused(again)) return { ok: true, reply: again, account: renewed.account }
  await markRevoked(access, accountId, renewed.token)
  return { ok: false, reason: 'account-revoked' }
}
