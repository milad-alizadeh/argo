import os from 'node:os'
import path from 'node:path'
import { findExecutableOnLoginShellPath } from '@/harnesses/host/executable-path'
import type { HarnessRegistration } from '@/harnesses/registration'
import { readClaudeHarnessInfo } from './catalog'
import { SESSION_CLAUDE_EXECUTABLE_ENV } from './proof-protocol'
import { createClaudeSignInDriver, createSystemClaudeReadiness } from './readiness'
import {
  claudeHistoryOwner,
  claudeHistoryTurn,
  openClaudeHistoryReader,
} from './session/claude-history-lines'
import { claudeSessionChannelOpener } from './session/claude-session-channel'
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
    openLiveSession: claudeSessionChannelOpener(executable),
    historyFiles: {
      directory: path.join(
        process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), '.claude'),
        'projects',
      ),
      ownerOf: claudeHistoryOwner,
      openReader: openClaudeHistoryReader,
      turnOf: claudeHistoryTurn,
    },
    rename: claudeSessionRenamer.rename,
    changeableTurnSettings: [],
    acceptsAttachments: false,
  }
}
