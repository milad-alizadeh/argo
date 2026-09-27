import type { HarnessRegistration } from '@/harnesses/registration'
import { createClaudeSignInDriver, createSystemClaudeReadiness } from './readiness'
import { readClaudeSessionHistory } from './session/claude-session-history'
import { claudeSessionRenamer } from './session/claude-session-rename'

export function createClaudeRegistration(): HarnessRegistration<'claude'> {
  return {
    harness: 'claude',
    sessionDiscovery: { kind: 'claude-session-discovery', harness: 'claude' },
    checkReadiness: createSystemClaudeReadiness(),
    signIn: createClaudeSignInDriver(),
    readHistory: ({ nativeId, subagentId, cwd }) =>
      readClaudeSessionHistory(subagentId ?? nativeId, cwd),
    rename: claudeSessionRenamer.rename,
  }
}
