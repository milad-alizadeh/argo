// A GitHub Account's sign-in: the device flow, then the identity it granted. GitHub's OAuth App
// tokens do not lapse, so there is no renewal.
import type { AccountErrorCode } from '../../domains/accounts/contract/contract'
import type { AccountProvider, SignInEnd } from '../../domains/accounts/main/providers'
import type { GrantOutcome } from '../grant'
import { awaitGrant, readIdentity, requestChallenge } from './device-flow'
import type { GitHubFailure } from './http'

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

export const githubAccounts: AccountProvider = {
  available: () => true,
  renew: null,
  async start({ github }) {
    const challenge = await requestChallenge(github)
    if (!challenge.ok) return FAILURE_ERRORS[challenge.failure]
    const { userCode, verificationUri, expiresIn } = challenge.value
    const controller = new AbortController()
    return {
      challenge: { provider: 'github', userCode, verificationUri },
      // Already checked to be on GitHub's web origin (device-flow.ts).
      url: verificationUri,
      expiresAt: Date.now() + expiresIn * 1000,
      async finish(): Promise<SignInEnd> {
        const outcome = await awaitGrant(github, challenge.value, controller.signal)
        if (outcome.kind !== 'granted') return { ok: false, code: OUTCOME_ERRORS[outcome.kind] }
        const identity = await readIdentity(github, outcome.grant.accessToken)
        if (!identity.ok) return { ok: false, code: FAILURE_ERRORS[identity.failure] }
        return { ok: true, signedIn: { identity: identity.value, grant: outcome.grant } }
      },
      async cancel() {
        controller.abort()
      },
    }
  },
}
