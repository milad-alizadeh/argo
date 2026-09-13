// A Linear Account's sign-in: authorization code + PKCE on a loopback redirect, then the viewer the
// grant belongs to. Linear's access tokens last a day and are renewed with the refresh token.
import type { AccountErrorCode } from '../../core/accounts/contract'
import type { AccountProvider, SignInEnd } from '../../core/accounts/providers'
import type { GrantOutcome } from '../grant'
import { AUTHORIZATION_PATIENCE_MILLISECONDS, beginAuthorization } from './authorization'
import type { LinearFailure } from './http'
import { readViewer } from './identity'
import { refreshGrant } from './tokens'

const OUTCOME_ERRORS: Record<Exclude<GrantOutcome['kind'], 'granted'>, AccountErrorCode> = {
  declined: 'sign-in-declined',
  expired: 'sign-in-expired',
  cancelled: 'sign-in-cancelled',
  unreachable: 'linear-unreachable',
  refused: 'sign-in-refused',
}

const FAILURE_ERRORS: Record<LinearFailure, AccountErrorCode> = {
  unauthorized: 'sign-in-refused',
  forbidden: 'sign-in-refused',
  'rate-limited': 'linear-rate-limited',
  unreachable: 'linear-unreachable',
}

export const linearAccounts: AccountProvider = {
  available: ({ linear }) => linear !== null,
  renew: ({ linear }, refreshToken) =>
    linear
      ? refreshGrant(linear, refreshToken)
      : Promise.resolve({ ok: false, failure: 'unreachable' }),
  async start({ linear }) {
    if (!linear) return 'provider-unavailable'
    const controller = new AbortController()
    const expiresAt = Date.now() + AUTHORIZATION_PATIENCE_MILLISECONDS
    const started = await beginAuthorization(linear, controller.signal)
    if (!started.ok) return 'sign-in-port-busy'
    const { url, outcome } = started.authorization
    return {
      challenge: { provider: 'linear' },
      url,
      expiresAt,
      async finish(): Promise<SignInEnd> {
        const ending = await outcome
        if (ending.kind !== 'granted') return { ok: false, code: OUTCOME_ERRORS[ending.kind] }
        const identity = await readViewer(linear, ending.grant.accessToken)
        if (!identity.ok) return { ok: false, code: FAILURE_ERRORS[identity.failure] }
        return { ok: true, signedIn: { identity: identity.value, grant: ending.grant } }
      },
      async cancel() {
        controller.abort()
        await outcome
      },
    }
  },
}
