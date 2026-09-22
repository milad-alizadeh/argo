// Reads `claude auth status --json`'s own shape (grounded live against claude 2.1.278):
// `loggedIn`, `apiProvider` ('firstParty' unless an org policy forces a gateway/Bedrock/Vertex
// path), and `apiKeySource`, present only when an inherited ANTHROPIC_API_KEY stands in for the
// OAuth grant. Argo reads that as signed out rather than a valid subscription: the AC bans
// offering API billing for Claude.
import type { HarnessReadiness } from '@/domains/harness-signin/contract/contract'

export type ClaudeStatusResult = { stdout: string }
export type ClaudeStatusRunner = () => Promise<ClaudeStatusResult>

type ClaudeAuthStatus = {
  loggedIn: boolean
  apiProvider: string | null
  apiKeySource: string | null
  subscriptionType: string | null
}

function parseStatus(stdout: string): ClaudeAuthStatus | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(stdout)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const { loggedIn, apiProvider, apiKeySource, subscriptionType } = parsed as Record<
    string,
    unknown
  >
  if (typeof loggedIn !== 'boolean') return null
  return {
    loggedIn,
    apiProvider: typeof apiProvider === 'string' ? apiProvider : null,
    apiKeySource: typeof apiKeySource === 'string' ? apiKeySource : null,
    subscriptionType: typeof subscriptionType === 'string' ? subscriptionType : null,
  }
}

export async function claudeReadiness(deps: {
  findExecutable: () => string | null
  runStatus: ClaudeStatusRunner
}): Promise<HarnessReadiness> {
  if (!deps.findExecutable()) return { harness: 'claude', state: 'missing', detail: null }
  const { stdout } = await deps.runStatus()
  const status = parseStatus(stdout)
  if (!status?.loggedIn) return { harness: 'claude', state: 'signed-out', detail: null }
  if (status.apiKeySource) return { harness: 'claude', state: 'signed-out', detail: 'api-key' }
  if (status.apiProvider !== 'firstParty') {
    return { harness: 'claude', state: 'policy-blocked', detail: status.apiProvider }
  }
  if (!status.subscriptionType) return { harness: 'claude', state: 'signed-out', detail: null }
  return { harness: 'claude', state: 'ready', detail: null }
}
