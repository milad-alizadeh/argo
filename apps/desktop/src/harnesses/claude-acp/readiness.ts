import type { HarnessReadiness } from '@/domains/harness-signin/contract/contract'
import type { HarnessSignInDriver } from '@/domains/harness-signin/main'
import { createClaudeSignInDriver, createSystemClaudeReadiness } from '@/harnesses/claude/readiness'

// The agent signs in through the Claude CLI's own account, so it is ready when both are there.
export function createClaudeAcpReadiness(
  executable: () => string | null,
  claudeReadiness: () => Promise<HarnessReadiness> = createSystemClaudeReadiness(),
): () => Promise<HarnessReadiness> {
  return async () =>
    executable() === null
      ? { harness: 'claude-acp', state: 'missing', detail: null }
      : { ...(await claudeReadiness()), harness: 'claude-acp' }
}

export function createClaudeAcpSignInDriver(
  checkReadiness: () => Promise<HarnessReadiness>,
  claude: HarnessSignInDriver = createClaudeSignInDriver(),
): HarnessSignInDriver {
  return { login: (signal) => claude.login(signal), checkReadiness }
}
