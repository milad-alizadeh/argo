// GitHub's device flow as the fake answers it: a code, a token once the code is entered, and the page
// where a person enters it.
import type { IncomingMessage } from 'node:http'
import { type Exchange, send } from './fake-exchange'

async function formOf(request: IncomingMessage): Promise<URLSearchParams> {
  let text = ''
  for await (const chunk of request) text += chunk
  return new URLSearchParams(text)
}

export function deviceCode({ state, response }: Exchange) {
  state.serial += 1
  const code = `device-${state.serial}`
  state.devices.set(code, { ...state.signIn })
  send(response, 200, {
    device_code: code,
    user_code: `ABCD-${String(1000 + state.serial)}`,
    verification_uri: `${state.origin}/login/device`,
    expires_in: 900,
    interval: state.signIn.held ? 1 : 0,
  })
}

export async function accessToken({ state, request, response }: Exchange) {
  const form = await formOf(request)
  const device = state.devices.get(form.get('device_code') ?? '')
  if (!device) return send(response, 200, { error: 'incorrect_device_code' })
  if (device.held) return send(response, 200, { error: 'authorization_pending' })
  if (device.pending > 0) {
    device.pending -= 1
    return send(response, 200, { error: 'authorization_pending' })
  }
  if (device.answer === 'declined') return send(response, 200, { error: 'access_denied' })
  if (device.answer === 'expired') return send(response, 200, { error: 'expired_token' })
  state.serial += 1
  const token = `token-${device.answer.login}-${state.serial}`
  state.tokens.set(token, device.answer)
  send(response, 200, { access_token: token, token_type: 'bearer', scope: 'repo,read:project' })
}

export function enterCode({ state, response }: Exchange) {
  for (const device of state.devices.values()) device.held = false
  response.writeHead(200, { 'Content-Type': 'text/html' })
  response.end('<h1>Device activated</h1>')
}
