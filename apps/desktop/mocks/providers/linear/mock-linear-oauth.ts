// Linear's OAuth as the mock answers it: a consent page that sends the browser back to the loopback,
// and a token endpoint that checks the PKCE verifier and rotates the refresh token on every renewal.
import { createHash } from 'node:crypto'
import {
  bodyOf,
  type MockConsent,
  type MockLinearState,
  type Route,
  reply,
} from './mock-linear-state'

function redirect(response: Parameters<Route>[2], target: URL) {
  response.writeHead(302, { Location: target.href })
  response.end()
}

export const authorize: Route = (state, request, response) => {
  const url = new URL(request.url ?? '/', state.origin)
  const params = url.searchParams
  const redirectUri = params.get('redirect_uri') ?? ''
  const challenge = params.get('code_challenge') ?? ''
  if (
    !URL.canParse(redirectUri) ||
    !params.get('client_id') ||
    params.get('response_type') !== 'code' ||
    params.get('code_challenge_method') !== 'S256' ||
    challenge === ''
  ) {
    return reply(response, 400, { error: 'invalid_request' })
  }
  const answer = state.signIn
  if (answer === 'held') {
    response.writeHead(200, { 'Content-Type': 'text/html' })
    return response.end('<h1>Authorize Argo</h1>')
  }
  const target = new URL(redirectUri)
  target.searchParams.set('state', params.get('state') ?? '')
  if (answer === 'declined') {
    target.searchParams.set('error', 'access_denied')
    return redirect(response, target)
  }
  state.serial += 1
  const code = `code-${state.serial}`
  const scope = (params.get('scope') ?? '').split(',').join(' ')
  state.codes.set(code, { user: answer, scope, challenge, redirectUri })
  target.searchParams.set('code', code)
  redirect(response, target)
}

function issue(state: MockLinearState, consent: MockConsent, response: Parameters<Route>[2]) {
  state.serial += 1
  const accessToken = `linear-access-${state.serial}`
  const refreshToken = `linear-refresh-${state.serial}`
  state.access.set(accessToken, {
    ...consent,
    expiresAt: Date.now() + state.lifetime * 1000,
  })
  state.refresh.set(refreshToken, { user: consent.user, scope: consent.scope })
  reply(response, 200, {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: state.lifetime,
    scope: consent.scope,
    refresh_token: refreshToken,
  })
}

const refused = (response: Parameters<Route>[2]) =>
  reply(response, 400, { error: 'invalid_grant', error_description: 'Refused' })

const verifies = (verifier: string, challenge: string) =>
  createHash('sha256').update(verifier).digest('base64url') === challenge

export const token: Route = async (state, request, response) => {
  if (state.outage === 'down') return reply(response, 503, { error: 'unavailable' })
  const form = new URLSearchParams(await bodyOf(request))
  if (!form.get('client_id')) return refused(response)
  if (form.get('grant_type') === 'refresh_token') {
    const presented = form.get('refresh_token') ?? ''
    const grant = state.refresh.get(presented)
    state.refresh.delete(presented)
    return grant ? issue(state, grant, response) : refused(response)
  }
  const code = state.codes.get(form.get('code') ?? '')
  state.codes.delete(form.get('code') ?? '')
  if (
    form.get('grant_type') !== 'authorization_code' ||
    !code ||
    code.redirectUri !== form.get('redirect_uri') ||
    !verifies(form.get('code_verifier') ?? '', code.challenge)
  ) {
    return refused(response)
  }
  issue(state, code, response)
}
