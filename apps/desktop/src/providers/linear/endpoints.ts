import { isLoopbackOrigin } from '@/shared/validation'

// The OAuth App the desktop authorizes to Linear as. Linear serves no device flow, so the grant is
// authorization code + PKCE through a loopback redirect, and the client id is public on the same
// terms as GitHub's (ADR-0018).
// Empty until the app is registered at Linear, a human act: until then no Linear sign-in is offered.
export const LINEAR_CLIENT_ID = ''
// `write` moves a Ticket to another status from the cockpit.
export const LINEAR_SCOPES = ['read', 'write']
// A redirect URI is registered ahead of time, so the loopback port is fixed rather than free.
export const LINEAR_REDIRECT_PORT = 51734

// Linear serves the consent page from the web host and the token exchange and GraphQL from the API
// host. A `redirectPort` of 0 takes whichever port is free, which only a proof's mock accepts.
export type LinearEndpoints = { web: string; api: string; clientId: string; redirectPort: number }

// Registering the OAuth App is the only step left: a client id here is what offers the sign-in.
export function linearEndpoints(clientId: string): LinearEndpoints | null {
  if (!clientId) return null
  return {
    web: 'https://linear.app',
    api: 'https://api.linear.app',
    clientId,
    redirectPort: LINEAR_REDIRECT_PORT,
  }
}

export const LINEAR_ENDPOINTS: LinearEndpoints | null = linearEndpoints(LINEAR_CLIENT_ID)

// A packaged proof points both hosts at a mock on this machine.
export function linearProofEndpoints(origin: string | undefined): LinearEndpoints | null {
  if (!isLoopbackOrigin(origin)) return null
  return { web: origin, api: origin, clientId: 'argo-proof', redirectPort: 0 }
}
