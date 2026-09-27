import { findExecutableOnLoginShellPath } from '@/harnesses/host/executable-path'
import { SESSION_CLAUDE_EXECUTABLE_ENV } from '@/harnesses/proof-protocol'
import type { HarnessRegistration } from '@/harnesses/registration'
import { readClaudeHarnessInfo } from './catalog'
import { createClaudeSignInDriver, createSystemClaudeReadiness } from './readiness'
import { readClaudeSessionHistory } from './session/claude-session-history'
import { claudeSessionRenamer } from './session/claude-session-rename'

export function createClaudeRegistration(): HarnessRegistration<'claude'> {
  const executable =
    process.env[SESSION_CLAUDE_EXECUTABLE_ENV] ?? findExecutableOnLoginShellPath('claude')
  return {
    harness: 'claude',
    checkReadiness: createSystemClaudeReadiness(),
    signIn: createClaudeSignInDriver(),
    readCatalog: () => readClaudeHarnessInfo(executable),
    readHistory: ({ nativeId, subagentId, cwd }) =>
      readClaudeSessionHistory(subagentId ?? nativeId, cwd),
    rename: claudeSessionRenamer.rename,
  }
}
