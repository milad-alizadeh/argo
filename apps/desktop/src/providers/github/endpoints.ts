import { isLoopbackOrigin } from '../../shared/validation'

// The registered OAuth App the desktop authorizes as. The client id is public by construction:
// a distributed binary cannot hold a secret, which is why GitHub's grant is the device flow
// (ADR-0018 · #367).
export const GITHUB_CLIENT_ID = 'Ov23liGeLJ8U6w5dq6oA'
export const GITHUB_SCOPES = ['repo', 'read:project']

// GitHub serves the device flow from the web host and everything else from the API host.
export type GitHubEndpoints = { web: string; api: string }

export const GITHUB_ENDPOINTS: GitHubEndpoints = {
  web: 'https://github.com',
  api: 'https://api.github.com',
}

// A packaged proof points both hosts at a mock on this machine.
export function proofEndpoints(origin: string | undefined): GitHubEndpoints | null {
  return isLoopbackOrigin(origin) ? { web: origin, api: origin } : null
}
