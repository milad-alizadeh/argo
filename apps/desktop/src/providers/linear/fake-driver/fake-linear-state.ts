// The state every fake Linear route reads and writes, and the one way a route answers.
import type { IncomingMessage, ServerResponse } from 'node:http'
import type {
  FakeLinearOutage,
  FakeLinearSignIn,
  FakeLinearTeam,
  FakeLinearUser,
} from './fake-linear'

// Who consented, and to which scopes, as Linear writes them back: space-separated.
export type FakeConsent = { user: FakeLinearUser; scope: string }
// A code the consent page issued, redeemable once by the verifier its challenge was made from.
export type FakeCode = FakeConsent & { challenge: string; redirectUri: string }

export type FakeLinearState = {
  origin: string
  signIn: FakeLinearSignIn
  codes: Map<string, FakeCode>
  access: Map<string, FakeConsent & { expiresAt: number }>
  refresh: Map<string, FakeConsent>
  teams: Map<string, FakeLinearTeam>
  outage: FakeLinearOutage
  lifetime: number
  serial: number
}

export type Route = (
  state: FakeLinearState,
  request: IncomingMessage,
  response: ServerResponse,
) => unknown

export function reply(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify(body))
}

export async function bodyOf(request: IncomingMessage): Promise<string> {
  let text = ''
  for await (const chunk of request) text += chunk
  return text
}
