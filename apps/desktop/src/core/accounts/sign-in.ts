// One GitHub device-flow sign-in at a time, held in the main process from challenge to grant. The
// renderer names the step; the device code, the grant and the browser stay here.
import {
  awaitGrant,
  type DeviceChallenge,
  type GrantOutcome,
  readIdentity,
  requestChallenge,
} from '../../providers/github/device-flow'
import type { GitHubFailure } from '../../providers/github/http'
import type { AccountAccess } from './access'
import {
  type AccountChallengeReply,
  type AccountConnectReply,
  type AccountErrorCode,
  accountError,
} from './contract'
import { listed } from './listing'
import { accountId } from './registry'
import { saveIdentity } from './save-identity'

type Pending = {
  challenge: DeviceChallenge
  expiresAt: number
  controller: AbortController
  outcome: Promise<GrantOutcome> | null
}

const OUTCOME_ERRORS: Record<Exclude<GrantOutcome['kind'], 'granted'>, AccountErrorCode> = {
  declined: 'sign-in-declined',
  expired: 'sign-in-expired',
  cancelled: 'sign-in-cancelled',
  unreachable: 'github-unreachable',
  refused: 'sign-in-refused',
}

const FAILURE_ERRORS: Record<GitHubFailure, AccountErrorCode> = {
  unauthorized: 'sign-in-refused',
  forbidden: 'sign-in-refused',
  'not-found': 'sign-in-refused',
  'rate-limited': 'rate-limited',
  unreachable: 'github-unreachable',
}

export function createSignIn(access: AccountAccess) {
  let pending: Pending | null = null

  const challengeReply = (requestId: string, current: Pending): AccountChallengeReply => ({
    version: 1,
    type: 'account.challenge',
    requestId,
    userCode: current.challenge.userCode,
    verificationUri: current.challenge.verificationUri,
    expiresAt: current.expiresAt,
  })

  async function finish(requestId: string, current: Pending): Promise<AccountConnectReply> {
    current.outcome ??= awaitGrant(access.endpoints, current.challenge, current.controller.signal)
    const outcome = await current.outcome
    if (pending === current) pending = null
    if (outcome.kind !== 'granted') return accountError(OUTCOME_ERRORS[outcome.kind], requestId)
    const identity = await readIdentity(access.endpoints, outcome.grant.accessToken)
    if (!identity.ok) return accountError(FAILURE_ERRORS[identity.failure], requestId)
    const id = accountId(identity.value.providerAccountId)
    const reply = await saveIdentity(access, requestId, {
      identity: identity.value,
      grant: outcome.grant,
    })
    if (reply.type === 'account.error') return reply
    return { ...reply.listed, type: 'account.connected', accountId: id, outcome: reply.outcome }
  }

  return {
    // A second connect replaces the first: the person asked again, so the old code is abandoned.
    async connect(requestId: string): Promise<AccountChallengeReply> {
      if (!access.grants.available()) return accountError('secure-storage-unavailable', requestId)
      pending?.controller.abort()
      pending = null
      const challenge = await requestChallenge(access.endpoints)
      if (!challenge.ok) return accountError(FAILURE_ERRORS[challenge.failure], requestId)
      const expiresAt = Date.now() + challenge.value.expiresIn * 1000
      pending = {
        challenge: challenge.value,
        expiresAt,
        controller: new AbortController(),
        outcome: null,
      }
      return challengeReply(requestId, pending)
    },

    // The only URL this opens is the one GitHub's own challenge named, already checked to be on
    // GitHub's web origin (src/providers/github/device-flow.ts).
    async verify(requestId: string): Promise<AccountChallengeReply> {
      if (!pending) return accountError('no-sign-in', requestId)
      const current = pending
      // A browser that will not open leaves the code on screen, which is all the person needs.
      await access.openExternal(current.challenge.verificationUri).catch(() => undefined)
      return challengeReply(requestId, current)
    },

    wait(requestId: string): Promise<AccountConnectReply> {
      if (!pending) return Promise.resolve(accountError('no-sign-in', requestId))
      return finish(requestId, pending)
    },

    cancel(requestId: string) {
      pending?.controller.abort()
      pending = null
      return listed(access, requestId)
    },

    dispose() {
      pending?.controller.abort()
      pending = null
    },
  }
}
