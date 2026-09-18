// Linear's token endpoint: a code exchanged for a grant, and a grant renewed before it lapses.
// Linear's access tokens last a day and each refresh rotates the refresh token, so the grant this
// returns replaces the stored one whole.
import { isRecord } from '../../shared/validation'
import { type Grant, grantedScopes, type TokenReply } from '../grant'
import { formBody, readJson, send } from '../request'
import type { LinearEndpoints } from './endpoints'

const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0

function grant(body: unknown, now: number): Grant | null {
  if (!isRecord(body) || !isText(body.access_token) || !isText(body.refresh_token)) return null
  const lifetime = body.expires_in
  if (typeof lifetime !== 'number' || !Number.isFinite(lifetime) || lifetime <= 0) return null
  return {
    accessToken: body.access_token,
    scopes: grantedScopes(body.scope),
    renewal: { refreshToken: body.refresh_token, expiresAt: now + lifetime * 1000 },
  }
}

async function requestToken(
  endpoints: LinearEndpoints,
  form: Record<string, string>,
): Promise<TokenReply> {
  const now = Date.now()
  const response = await send(`${endpoints.api}/oauth/token`, formBody(form))
  if (!response || response.status >= 500) return { ok: false, failure: 'unreachable' }
  if (response.status === 429) return { ok: false, failure: 'rate-limited' }
  const body = await readJson(response)
  if (isRecord(body) && isText(body.error)) return { ok: false, failure: 'refused' }
  const granted = response.ok ? grant(body, now) : null
  return granted ? { ok: true, grant: granted } : { ok: false, failure: 'unreachable' }
}

// PKCE proves the exchange with the verifier, so no client secret is sent.
export function exchangeCode(
  endpoints: LinearEndpoints,
  exchange: { code: string; verifier: string; redirectUri: string },
): Promise<TokenReply> {
  return requestToken(endpoints, {
    grant_type: 'authorization_code',
    code: exchange.code,
    redirect_uri: exchange.redirectUri,
    client_id: endpoints.clientId,
    code_verifier: exchange.verifier,
  })
}

export function refreshGrant(
  endpoints: LinearEndpoints,
  refreshToken: string,
): Promise<TokenReply> {
  return requestToken(endpoints, {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: endpoints.clientId,
  })
}
