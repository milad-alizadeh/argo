// GitHub's device flow in two calls: the challenge the person is shown, then the wait for their
// answer. Nothing here opens a browser; that is the main process's own authority.
import { setTimeout as sleep } from 'node:timers/promises'
import { isRecord } from '../../boundary'
import { GITHUB_CLIENT_ID, GITHUB_SCOPES, type GitHubEndpoints } from './endpoints'
import { failed, type GitHubRead, get, postForm } from './http'

export type DeviceChallenge = {
  deviceCode: string
  userCode: string
  verificationUri: string
  expiresIn: number
  interval: number
}

// The scopes recorded are the ones granted, never the ones asked for: an org can grant less.
export type Grant = { accessToken: string; scopes: string[] }

export type GrantOutcome =
  | { kind: 'granted'; grant: Grant }
  | { kind: 'declined' | 'expired' | 'cancelled' | 'unreachable' | 'refused' }

export type GitHubIdentity = { providerAccountId: string; login: string }

// GitHub's documented step when it asks for slower polls without naming an interval.
const SLOW_DOWN_SECONDS = 5

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0

const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0

function onHost(uri: unknown, origin: string): uri is string {
  if (!isText(uri)) return false
  try {
    return new URL(uri).origin === origin
  } catch {
    return false
  }
}

export async function requestChallenge(
  endpoints: GitHubEndpoints,
): Promise<GitHubRead<DeviceChallenge>> {
  const reply = await postForm(`${endpoints.web}/login/device/code`, {
    client_id: GITHUB_CLIENT_ID,
    scope: GITHUB_SCOPES.join(' '),
  })
  if (!reply.ok) return reply
  const body = reply.value
  if (
    !isRecord(body) ||
    !isText(body.device_code) ||
    !isText(body.user_code) ||
    !onHost(body.verification_uri, endpoints.web) ||
    !isCount(body.expires_in) ||
    !isCount(body.interval)
  ) {
    return failed('unreachable')
  }
  return {
    ok: true,
    value: {
      deviceCode: body.device_code,
      userCode: body.user_code,
      verificationUri: body.verification_uri,
      expiresIn: body.expires_in,
      interval: body.interval,
    },
  }
}

type Poll = GrantOutcome | { kind: 'pending'; interval: number }

async function poll(
  endpoints: GitHubEndpoints,
  challenge: DeviceChallenge,
  interval: number,
): Promise<Poll> {
  const reply = await postForm(`${endpoints.web}/login/oauth/access_token`, {
    client_id: GITHUB_CLIENT_ID,
    device_code: challenge.deviceCode,
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
  })
  if (!reply.ok) return { kind: 'unreachable' }
  const body = reply.value
  if (!isRecord(body)) return { kind: 'unreachable' }
  if (isText(body.access_token)) {
    const scopes = typeof body.scope === 'string' ? body.scope.split(/[\s,]+/).filter(Boolean) : []
    return { kind: 'granted', grant: { accessToken: body.access_token, scopes } }
  }
  switch (body.error) {
    case 'authorization_pending':
      return { kind: 'pending', interval }
    case 'slow_down':
      return {
        kind: 'pending',
        interval: isCount(body.interval) ? body.interval : interval + SLOW_DOWN_SECONDS,
      }
    case 'access_denied':
      return { kind: 'declined' }
    case 'expired_token':
      return { kind: 'expired' }
    default:
      return { kind: 'refused' }
  }
}

// The window is spent by the clock rather than by counting waits, so an endpoint that answers
// `authorization_pending` forever ends in `expired`.
export async function awaitGrant(
  endpoints: GitHubEndpoints,
  challenge: DeviceChallenge,
  signal: AbortSignal,
): Promise<GrantOutcome> {
  const deadline = Date.now() + challenge.expiresIn * 1000
  let interval = challenge.interval
  while (Date.now() < deadline) {
    try {
      await sleep(interval * 1000, undefined, { signal })
    } catch {
      return { kind: 'cancelled' }
    }
    const outcome = await poll(endpoints, challenge, interval)
    if (signal.aborted) return { kind: 'cancelled' }
    if (outcome.kind !== 'pending') return outcome
    interval = outcome.interval
  }
  return { kind: 'expired' }
}

// The numeric id is the Account's key and the login a display attribute, so this read decides
// whether a grant is a new Account or one already held under a since-renamed login.
export async function readIdentity(
  endpoints: GitHubEndpoints,
  token: string,
): Promise<GitHubRead<GitHubIdentity>> {
  const reply = await get(`${endpoints.api}/user`, token)
  if (!reply.ok) return reply
  const user = reply.value
  if (!isRecord(user) || !isCount(user.id) || !isText(user.login)) return failed('unreachable')
  return { ok: true, value: { providerAccountId: String(user.id), login: user.login } }
}
