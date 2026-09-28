import os from 'node:os'
import path from 'node:path'
import { findExecutableOnLoginShellPath } from '@/harnesses/host/executable-path'
import { watchVendorHistory } from '@/harnesses/host/history-watch'
import { SESSION_CLAUDE_EXECUTABLE_ENV } from '@/harnesses/proof-protocol'
import type { HarnessRegistration } from '@/harnesses/registration'
import { readClaudeHarnessInfo } from './catalog'
import { createClaudeSignInDriver, createSystemClaudeReadiness } from './readiness'
import { openClaudeSessionChannel } from './session/claude-session-channel'
import { discoverClaudeSessions } from './session/claude-session-discovery'
import { readClaudeSessionHistory } from './session/claude-session-history'
import { claudeSessionRenamer } from './session/claude-session-rename'

export function createClaudeRegistration(): HarnessRegistration<'claude'> {
  const executable =
    process.env[SESSION_CLAUDE_EXECUTABLE_ENV] ?? findExecutableOnLoginShellPath('claude')
  return {
    harness: 'claude',
    sessionDiscovery: discoverClaudeSessions,
    checkReadiness: createSystemClaudeReadiness(),
    signIn: createClaudeSignInDriver(),
    readCatalog: () => readClaudeHarnessInfo(executable),
    readHistory: ({ nativeId, subagentId, cwd }) =>
      readClaudeSessionHistory(nativeId, cwd, subagentId),
    openLiveSession: openClaudeSessionChannel,
    watchHistory: ({ nativeId, subagentId }, invalidate) =>
      watchVendorHistory(
        path.join(process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), '.claude'), 'projects'),
        subagentId ?? nativeId,
        invalidate,
      ),
    rename: claudeSessionRenamer.rename,
  }
}
