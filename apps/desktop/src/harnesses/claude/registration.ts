import { findExecutableOnLoginShellPath } from '@/harnesses/host/executable-path'
import type { HarnessRegistration } from '@/harnesses/registration'
import { readClaudeHarnessInfo } from './catalog'
import {
  HARNESS_SIGNIN_CLAUDE_EXECUTABLE_ENV,
  SESSION_CLAUDE_EXECUTABLE_ENV,
} from './proof-protocol'
import { createClaudeSignInDriver, createSystemClaudeReadiness } from './readiness'
import {
  claudeSessionChannelOpener,
  claudeSessionRenamer,
  createClaudeExternalSessions,
  getClaudeSessionSummary,
  listClaudeSessionSummaries,
  readClaudeSessionHistory,
  readClaudeSkillCommands,
} from './session'

export function createClaudeRegistration(): HarnessRegistration<'claude'> {
  const executable =
    process.env[SESSION_CLAUDE_EXECUTABLE_ENV] ?? findExecutableOnLoginShellPath('claude')
  const signInExecutable = process.env[HARNESS_SIGNIN_CLAUDE_EXECUTABLE_ENV]
  return {
    harness: 'claude',
    listSessionSummaries: listClaudeSessionSummaries,
    getSessionSummary: (nativeId) => getClaudeSessionSummary(nativeId),
    checkReadiness: createSystemClaudeReadiness(signInExecutable),
    signIn: createClaudeSignInDriver(signInExecutable),
    readCatalog: () => readClaudeHarnessInfo(executable),
    readHistory: ({ nativeId, subagentId, cwd }) =>
      readClaudeSessionHistory(nativeId, cwd, subagentId),
    externalSessions: createClaudeExternalSessions(executable),
    openLiveSession: claudeSessionChannelOpener(executable),
    listCommands: ({ cwd }) => {
      let rejected = 0
      return readClaudeSkillCommands({
        cwd,
        reject: () => {
          rejected += 1
        },
      }).then((commands) => {
        if (rejected > 0) console.warn(`Rejected ${rejected} unsupported Claude skill shape(s).`)
        return { availability: 'listed' as const, commands }
      })
    },
    rename: claudeSessionRenamer.rename,
    changeableTurnSettings: [],
    acceptsAttachments: false,
  }
}
