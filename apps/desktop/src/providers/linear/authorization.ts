// Linear's authorization code grant with PKCE, caught on a loopback redirect. The port is claimed
// before the browser opens, so a port another process holds refuses before anyone consents, and the
// loopback answers exactly one callback. Nothing here opens a browser; that is the main process's.
import { createHash, randomBytes } from 'node:crypto'
import { createServer, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { GrantOutcome } from '../grant'
import { LINEAR_SCOPES, type LinearEndpoints } from './endpoints'
import { exchangeCode } from './tokens'

const CALLBACK_PATH = '/linear/callback'
// How long the loopback waits for the browser before the sign-in ends as expired.
export const AUTHORIZATION_PATIENCE_MILLISECONDS = 300_000

export type Authorization = { url: string; outcome: Promise<GrantOutcome> }

export type AuthorizationStart =
  | { ok: true; authorization: Authorization }
  | { ok: false; failure: 'port-busy' }

const randomToken = () => randomBytes(32).toString('base64url')

// S256 only: `plain` would make the challenge the secret it protects.
const challengeFor = (verifier: string) => createHash('sha256').update(verifier).digest('base64url')

const PAGES: Record<GrantOutcome['kind'], string> = {
  granted: 'Linear is connected to Argo. You can close this tab.',
  declined: 'The Linear sign-in was declined. You can close this tab.',
  expired: 'This Linear sign-in has ended. Start again in Argo.',
  cancelled: 'This Linear sign-in has ended. Start again in Argo.',
  unreachable: 'Argo could not reach Linear to finish signing in. Try again in Argo.',
  refused: 'Linear did not accept this sign-in. Start again in Argo.',
}

function answerPage(response: ServerResponse, outcome: GrantOutcome) {
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', Connection: 'close' })
  response.end(`<!doctype html><title>Argo</title><p>${PAGES[outcome.kind]}</p>`)
}

function listen(port: number) {
  const server = createServer()
  return new Promise<typeof server | null>((resolve) => {
    server.once('error', () => resolve(null))
    server.listen(port, '127.0.0.1', () => resolve(server))
  })
}

type Secrets = { state: string; verifier: string; redirectUri: string }

// The state is checked before the code is spent: a callback naming another request is refused.
async function redeem(
  endpoints: LinearEndpoints,
  secrets: Secrets,
  params: URLSearchParams,
): Promise<GrantOutcome> {
  if (params.get('state') !== secrets.state) return { kind: 'refused' }
  const error = params.get('error')
  if (error) return { kind: error === 'access_denied' ? 'declined' : 'refused' }
  const code = params.get('code')
  if (!code) return { kind: 'refused' }
  const reply = await exchangeCode(endpoints, { code, ...secrets })
  if (reply.ok) return { kind: 'granted', grant: reply.grant }
  return { kind: reply.failure === 'refused' ? 'refused' : 'unreachable' }
}

function authorizeURL(endpoints: LinearEndpoints, secrets: Secrets): string {
  const url = new URL('/oauth/authorize', endpoints.web)
  url.search = new URLSearchParams({
    client_id: endpoints.clientId,
    redirect_uri: secrets.redirectUri,
    response_type: 'code',
    scope: LINEAR_SCOPES.join(','),
    state: secrets.state,
    code_challenge: challengeFor(secrets.verifier),
    code_challenge_method: 'S256',
  }).toString()
  return url.href
}

export async function beginAuthorization(
  endpoints: LinearEndpoints,
  signal: AbortSignal,
  patience = AUTHORIZATION_PATIENCE_MILLISECONDS,
): Promise<AuthorizationStart> {
  const server = await listen(endpoints.redirectPort)
  if (!server) return { ok: false, failure: 'port-busy' }
  const { port } = server.address() as AddressInfo
  const secrets = {
    state: randomToken(),
    verifier: randomToken(),
    redirectUri: `http://127.0.0.1:${port}${CALLBACK_PATH}`,
  }
  const outcome = new Promise<GrantOutcome>((resolve) => {
    let answered = false
    let settled = false
    const finish = (ending: GrantOutcome) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal.removeEventListener('abort', cancel)
      // Settled once the port is free again, so a sign-in started next can claim it.
      server.close(() => resolve(ending))
    }
    const cancel = () => finish({ kind: 'cancelled' })
    const timer = setTimeout(() => finish({ kind: 'expired' }), patience)
    signal.addEventListener('abort', cancel, { once: true })
    if (signal.aborted) cancel()
    server.on('request', async (request, response) => {
      const url = new URL(request.url ?? '/', secrets.redirectUri)
      if (answered || request.method !== 'GET' || url.pathname !== CALLBACK_PATH) {
        response.writeHead(404, { Connection: 'close' }).end()
        return
      }
      answered = true
      const ending = await redeem(endpoints, secrets, url.searchParams)
      answerPage(response, ending)
      finish(ending)
    })
  })
  return { ok: true, authorization: { url: authorizeURL(endpoints, secrets), outcome } }
}
