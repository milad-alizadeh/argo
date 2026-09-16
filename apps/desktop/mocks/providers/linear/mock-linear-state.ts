// The state every mock Linear route reads and writes, and the one way a route answers.
import type { IncomingMessage, ServerResponse } from 'node:http'
import type {
  MockLinearOutage,
  MockLinearSignIn,
  MockLinearTeam,
  MockLinearUser,
} from './mock-linear'

// Who consented, and to which scopes, as Linear writes them back: space-separated.
export type MockConsent = { user: MockLinearUser; scope: string }
// A code the consent page issued, redeemable once by the verifier its challenge was made from.
export type MockCode = MockConsent & { challenge: string; redirectUri: string }

export type MockLinearState = {
  origin: string
  signIn: MockLinearSignIn
  codes: Map<string, MockCode>
  access: Map<string, MockConsent & { expiresAt: number }>
  refresh: Map<string, MockConsent>
  teams: Map<string, MockLinearTeam>
  outage: MockLinearOutage
  lifetime: number
  serial: number
}

export type Route = (
  state: MockLinearState,
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
