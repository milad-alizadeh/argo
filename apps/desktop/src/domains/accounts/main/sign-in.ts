// One sign-in at a time, to either provider, held in the main process from challenge to grant. The
// renderer names the step; the device code, the PKCE verifier, the grant and the browser stay here.

import {
  type AccountChallengeReply,
  type AccountConnectReply,
  accountError,
  type Provider,
} from '@/domains/accounts/contract/contract'
import type { AccountAccess } from './access'
import { listed } from './listing'
import type { SignInEnd, SignInStart } from './providers'
import { accountId } from './registry'
import { saveIdentity } from './save-identity'

type Pending = { provider: Provider; start: SignInStart; outcome: Promise<SignInEnd> | null }

export function createSignIn(access: AccountAccess) {
  let pending: Pending | null = null

  const challengeReply = (requestId: string, current: Pending): AccountChallengeReply => ({
    version: 1,
    type: 'account.challenge',
    requestId,
    ...current.start.challenge,
    expiresAt: current.start.expiresAt,
  })

  const abandon = async () => {
    const current = pending
    pending = null
    await current?.start.cancel()
  }

  async function finish(requestId: string, current: Pending): Promise<AccountConnectReply> {
    current.outcome ??= current.start.finish()
    const outcome = await current.outcome
    if (pending === current) pending = null
    if (!outcome.ok) return accountError(outcome.code, requestId)
    const { identity } = outcome.signedIn
    const id = accountId(current.provider, identity.providerAccountId)
    const reply = await saveIdentity(access, requestId, {
      ...outcome.signedIn,
      provider: current.provider,
    })
    if (reply.type === 'account.error') return reply
    return { ...reply.listed, type: 'account.connected', accountId: id, outcome: reply.outcome }
  }

  return {
    // A second connect replaces the first: the person asked again, so the old sign-in is abandoned.
    async connect(requestId: string, provider: Provider): Promise<AccountChallengeReply> {
      if (!access.grants.available()) return accountError('secure-storage-unavailable', requestId)
      const source = access.providers[provider]
      if (!source.available(access.endpoints)) {
        return accountError('provider-unavailable', requestId)
      }
      await abandon()
      const start = await source.start(access.endpoints)
      if (typeof start === 'string') return accountError(start, requestId)
      pending = { provider, start, outcome: null }
      return challengeReply(requestId, pending)
    },

    // Opens the page the provider's own sign-in named or main built; asked again, opens it again.
    async verify(requestId: string): Promise<AccountChallengeReply> {
      if (!pending) return accountError('no-sign-in', requestId)
      const current = pending
      // A browser that will not open leaves the step on screen, with a way to open it again.
      await access.openExternal(current.start.url).catch(() => undefined)
      return challengeReply(requestId, current)
    },

    wait(requestId: string): Promise<AccountConnectReply> {
      if (!pending) return Promise.resolve(accountError('no-sign-in', requestId))
      return finish(requestId, pending)
    },

    async cancel(requestId: string) {
      await abandon()
      return listed(access, requestId)
    },

    dispose() {
      void abandon()
    },
  }
}
