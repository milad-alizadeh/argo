import { isLoopbackOrigin } from '../../boundary'

// The OAuth App the desktop authorizes to Linear as. Linear serves no device flow, so the grant is
// authorization code + PKCE through a loopback redirect, and the client id is public on the same
// terms as GitHub's (ADR-0018).
// Empty until the app is registered at Linear, a human act: until then no Linear sign-in is offered.
export const LINEAR_CLIENT_ID = ''
// Read only until the Ticket writes of #1851 need `write`.
export const LINEAR_SCOPES = ['read']
// A redirect URI is registered ahead of time, so the loopback port is fixed rather than free.
export const LINEAR_REDIRECT_PORT = 51734

// Linear serves the consent page from the web host and the token exchange and GraphQL from the API
// host. A `redirectPort` of 0 takes whichever port is free, which only a proof's fake accepts.
export type LinearEndpoints = { web: string; api: string; clientId: string; redirectPort: number }

export const LINEAR_ENDPOINTS: LinearEndpoints | null = LINEAR_CLIENT_ID
  ? {
      web: 'https://linear.app',
      api: 'https://api.linear.app',
      clientId: LINEAR_CLIENT_ID,
      redirectPort: LINEAR_REDIRECT_PORT,
    }
  : null

// A packaged proof points both hosts at a fake on this machine.
export function linearProofEndpoints(origin: string | undefined): LinearEndpoints | null {
  if (!isLoopbackOrigin(origin)) return null
  return { web: origin, api: origin, clientId: 'argo-proof', redirectPort: 0 }
}
