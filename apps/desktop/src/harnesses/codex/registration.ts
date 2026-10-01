import os from 'node:os'
import path from 'node:path'
import type { HarnessRegistration } from '@/harnesses/registration'
import type { CodexAppServerClient } from './app-server'
import { readCodexHarnessInfo } from './catalog'
import { readAutoCompactLimit, writeAutoCompactLimit } from './compaction'
import { HARNESS_SIGNIN_CODEX_EXECUTABLE_ENV } from './proof-protocol'
import { createCodexSignInDriver, createSystemCodexReadiness } from './readiness'
import {
  createCodexExternalSessions,
  createCodexSessionSummaryList,
  createCodexSessionSummaryReader,
  hasCodexSessionTurn,
  openCodexSessionChannel,
  readCodexSessionHistory,
  readCodexSkillCommands,
} from './session'

export function createCodexRegistration(
  client: CodexAppServerClient,
): HarnessRegistration<'codex'> {
  const { request } = client
  const codexHome = process.env.CODEX_HOME ?? path.join(os.homedir(), '.codex')
  const signInExecutable = process.env[HARNESS_SIGNIN_CODEX_EXECUTABLE_ENV]
  return {
    harness: 'codex',
    listSessionSummaries: createCodexSessionSummaryList(request),
    getSessionSummary: createCodexSessionSummaryReader(request),
    checkReadiness: createSystemCodexReadiness(signInExecutable),
    signIn: createCodexSignInDriver(signInExecutable),
    readCatalog: () => readCodexHarnessInfo(request),
    readHistory: ({ nativeId, subagentId }) =>
      readCodexSessionHistory(request, subagentId ?? nativeId),
    hasTurn: (nativeId, turnId) => hasCodexSessionTurn(request, nativeId, turnId),
    externalSessions: createCodexExternalSessions(request, codexHome),
    openLiveSession: (input, controls, emit) =>
      openCodexSessionChannel(input, client, { emit, controls }),
    listCommands: ({ cwd }) => {
      let rejected = 0
      return readCodexSkillCommands({
        cwd,
        codexHome,
        reject: () => {
          rejected += 1
        },
      }).then((commands) => {
        if (rejected > 0) console.warn(`Rejected ${rejected} unsupported Codex skill shape(s).`)
        return { availability: 'listed' as const, commands }
      })
    },
    changeableTurnSettings: ['model', 'effort'],
    acceptsAttachments: true,
    autoCompactLimit: {
      read: () => readAutoCompactLimit(codexHome),
      write: (limit) => writeAutoCompactLimit(codexHome, limit),
    },
    shutdown: () => client.shutdown(),
  }
}
