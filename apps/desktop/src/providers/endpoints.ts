// Where each provider is reached. A provider left null offers no sign-in (ADR-0018).

import { GITHUB_ENDPOINTS, type GitHubEndpoints, proofEndpoints } from './github/endpoints'
import { LINEAR_ENDPOINTS, type LinearEndpoints, linearProofEndpoints } from './linear/endpoints'
import { GITHUB_PROOF_ORIGIN_ENV, LINEAR_PROOF_ORIGIN_ENV } from './proof-protocol'

export type ProviderEndpoints = { github: GitHubEndpoints; linear: LinearEndpoints | null }

// The Ticket proof (#1848, #1849) points each provider at a mock on a loopback port. Only a proof
// run may, and a value that is not a loopback origin stops the launch before a real provider is hit.
function proofOrigin<T>(
  variable: string,
  parse: (origin: string) => T | null,
  enabled: boolean,
): T | undefined {
  const origin = process.env[variable]
  if (!enabled || origin === undefined) return undefined
  const endpoints = parse(origin)
  if (!endpoints) throw new Error(`${variable} is not a loopback origin`)
  return endpoints
}

export function providerEndpoints(proofEnabled: boolean): ProviderEndpoints {
  return {
    github: proofOrigin(GITHUB_PROOF_ORIGIN_ENV, proofEndpoints, proofEnabled) ?? GITHUB_ENDPOINTS,
    linear:
      proofOrigin(LINEAR_PROOF_ORIGIN_ENV, linearProofEndpoints, proofEnabled) ?? LINEAR_ENDPOINTS,
  }
}
