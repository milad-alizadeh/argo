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

// A packaged proof points both hosts at a fake on this machine. Only a loopback origin is taken,
// so a stray value cannot send a bearer token anywhere else.
export function proofEndpoints(origin: string | undefined): GitHubEndpoints | null {
  if (!origin) return null
  let url: URL
  try {
    url = new URL(origin)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.origin !== origin) {
    return null
  }
  return { web: origin, api: origin }
}
