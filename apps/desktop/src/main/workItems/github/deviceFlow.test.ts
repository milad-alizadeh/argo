import { describe, expect, it } from 'vitest'
import type { Http, HttpResponse } from '../http'
import type { DeviceCode } from './deviceFlow'
import { githubClientId, signInWithDeviceFlow } from './deviceFlow'

// The device flow, run for real against a scripted provider. What matters here is not the
// wire format but the two promises the panel depends on: the code appears BEFORE the wait,
// and the wait ends on the provider's answer rather than on a guess.

const ok = (body: unknown): HttpResponse => ({ status: 200, body, headers: {} })

const START = {
  device_code: 'dev-code',
  user_code: 'WDJB-MJHT',
  verification_uri: 'https://github.com/login/device',
  expires_in: 900,
  interval: 5,
}

interface Scripted {
  http: Http
  waits: number[]
  codes: DeviceCode[]
}

/** A provider that answers the token poll with `replies` in order, one per poll. */
function scripted(replies: unknown[]): Scripted {
  const waits: number[] = []
  const codes: DeviceCode[] = []
  let poll = 0

  return {
    waits,
    codes,
    http: (request) => {
      if (request.url.endsWith('/device/code')) return Promise.resolve(ok(START))
      const reply = replies[poll] ?? { error: 'authorization_pending' }
      poll += 1
      return Promise.resolve(ok(reply))
    },
  }
}

function run(script: Scripted): ReturnType<typeof signInWithDeviceFlow> {
  return signInWithDeviceFlow({
    http: script.http,
    clientId: 'Iv1.test',
    onCode: (code) => script.codes.push(code),
    wait: (ms) => {
      script.waits.push(ms)
      return Promise.resolve()
    },
  })
}

describe('which app a sign-in authorizes against', () => {
  it('ships Argo own app, so a user sets nothing to connect', () => {
    expect(githubClientId({})).toMatch(/^Ov23li/)
  })

  it('lets a fork point at its own app', () => {
    expect(githubClientId({ ARGO_GITHUB_CLIENT_ID: 'Ov23liOther' })).toBe('Ov23liOther')
  })

  it('reads a blank override as no override, not as a build with no app', () => {
    expect(githubClientId({ ARGO_GITHUB_CLIENT_ID: '  ' })).toMatch(/^Ov23li/)
  })
})

describe('surfacing the code', () => {
  it('hands the user code and verification URL to the caller', async () => {
    const script = scripted([{ access_token: 'gho_test' }])
    await run(script)
    expect(script.codes[0]).toEqual({
      userCode: 'WDJB-MJHT',
      verificationUri: 'https://github.com/login/device',
      expiresIn: 900,
      interval: 5,
    })
  })

  it('surfaces the code before the first wait, not after it', async () => {
    // A panel that only learns the code once the flow finishes has spun blind the whole time.
    const script = scripted([{ access_token: 'gho_test' }])
    const order: string[] = []
    await signInWithDeviceFlow({
      http: script.http,
      clientId: 'Iv1.test',
      onCode: () => order.push('code'),
      wait: () => {
        order.push('wait')
        return Promise.resolve()
      },
    })
    expect(order[0]).toBe('code')
  })

  it('refuses when the provider issues no code at all', async () => {
    const http: Http = () => Promise.resolve(ok({ error: 'unauthorized_client' }))
    const result = await signInWithDeviceFlow({
      http,
      clientId: 'Iv1.test',
      onCode: () => undefined,
      wait: () => Promise.resolve(),
    })
    expect(result).toEqual({ ok: false, detail: 'GitHub did not issue a device code' })
  })
})

describe('waiting for the grant', () => {
  it('keeps polling while the provider says authorization is pending', async () => {
    const script = scripted([
      { error: 'authorization_pending' },
      { error: 'authorization_pending' },
      { access_token: 'gho_test' },
    ])
    expect(await run(script)).toEqual({ ok: true, token: 'gho_test' })
    expect(script.waits).toHaveLength(3)
  })

  it('backs off when the provider says to slow down', async () => {
    // `slow_down` is an instruction, not a failure. Ignoring it earns a hard refusal.
    const script = scripted([{ error: 'slow_down' }, { access_token: 'gho_test' }])
    expect(await run(script)).toEqual({ ok: true, token: 'gho_test' })
    expect(script.waits).toEqual([5000, 10_000])
  })

  it('reports a refusal in the provider own terms and stops asking', async () => {
    const script = scripted([{ error: 'access_denied' }])
    expect(await run(script)).toEqual({ ok: false, detail: 'access_denied' })
    expect(script.waits).toHaveLength(1)
  })

  it('gives up once the code has outlived the window the provider gave it', async () => {
    const script = scripted([])
    const result = await run(script)
    expect(result).toEqual({
      ok: false,
      detail: 'the device code expired before it was entered',
    })
    expect(script.waits).toHaveLength(900 / 5)
  })
})
