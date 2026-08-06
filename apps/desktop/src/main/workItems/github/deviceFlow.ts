import type { Http } from '../http'

// GitHub's OAuth device flow (ADR-0018) — the grant that needs no `client_secret`, which a
// distributed desktop binary cannot hold. Per-provider by design, so this file is GitHub's.
// The user code reaches the caller BEFORE the wait, so the panel shows what to type.

const DEVICE_CODE_URL = 'https://github.com/login/device/code'
const TOKEN_URL = 'https://github.com/login/oauth/access_token'
const GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code'

/** Enough to read issues and their dependencies on public and private repositories. One grant
 * feeds both ports (ADR-0018), which is why it is not narrowed to issues alone. */
const SCOPE = 'repo'

/** What the user must act on, surfaced as soon as GitHub issues it. */
export interface DeviceCode {
  userCode: string
  verificationUri: string
  /** Seconds GitHub will honour this code for. */
  expiresIn: number
  /** Seconds GitHub asks us to wait between polls. */
  interval: number
}

export type SignIn = { ok: true; token: string } | { ok: false; detail: string }

export interface DeviceFlowOptions {
  http: Http
  clientId: string
  /** Called once, with the code to type and where to type it. */
  onCode: (code: DeviceCode) => void
  /** Injected so a suite runs the real polling loop without spending its interval. */
  wait: (ms: number) => Promise<void>
}

export async function signInWithDeviceFlow(options: DeviceFlowOptions): Promise<SignIn> {
  const start = await post(options.http, DEVICE_CODE_URL, {
    client_id: options.clientId,
    scope: SCOPE,
  })
  const code = parseDeviceCode(start)
  if (code === null) return { ok: false, detail: 'GitHub did not issue a device code' }

  options.onCode(code)
  return awaitToken(options, code, readString(start, 'device_code') ?? '')
}

// GitHub answers every poll with 200 and an `error` field rather than an HTTP status, so the
// loop reads the body. `slow_down` is an instruction, not a failure: it means keep waiting and
// ask less often, and ignoring it earns a hard refusal.
async function awaitToken(
  options: DeviceFlowOptions,
  code: DeviceCode,
  deviceCode: string,
): Promise<SignIn> {
  let interval = code.interval
  const deadline = code.expiresIn

  for (let waited = 0; waited < deadline; waited += interval) {
    await options.wait(interval * 1000)
    const body = await post(options.http, TOKEN_URL, {
      client_id: options.clientId,
      device_code: deviceCode,
      grant_type: GRANT_TYPE,
    })

    const token = readString(body, 'access_token')
    if (token !== null) return { ok: true, token }

    const error = readString(body, 'error')
    if (error === 'slow_down') interval += 5
    else if (error !== 'authorization_pending')
      return { ok: false, detail: error ?? 'sign-in failed' }
  }
  return { ok: false, detail: 'the device code expired before it was entered' }
}

async function post(http: Http, url: string, form: Record<string, string>): Promise<unknown> {
  const response = await http({
    method: 'POST',
    url,
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify(form),
  })
  return response.body
}

function parseDeviceCode(body: unknown): DeviceCode | null {
  const userCode = readString(body, 'user_code')
  const verificationUri = readString(body, 'verification_uri')
  if (userCode === null || verificationUri === null) return null
  return {
    userCode,
    verificationUri,
    expiresIn: readNumber(body, 'expires_in') ?? 900,
    // GitHub's documented floor. Polling faster than the provider asked earns a `slow_down`.
    interval: readNumber(body, 'interval') ?? 5,
  }
}

function field(body: unknown, key: string): unknown {
  if (typeof body !== 'object' || body === null) return undefined
  return key in body ? Reflect.get(body, key) : undefined
}

function readString(body: unknown, key: string): string | null {
  const value = field(body, key)
  return typeof value === 'string' && value !== '' ? value : null
}

function readNumber(body: unknown, key: string): number | null {
  const value = field(body, key)
  return typeof value === 'number' ? value : null
}
