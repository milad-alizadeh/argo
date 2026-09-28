import os from 'node:os'
import path from 'node:path'
import { watchVendorHistory } from '@/harnesses/host/history-watch'
import type { HarnessRegistration } from '@/harnesses/registration'
import type { CodexAppServerClient } from './app-server/codex-app-server-client'
import { readCodexHarnessInfo } from './catalog'
import { readAutoCompactLimit, writeAutoCompactLimit } from './compaction/config-file'
import { createCodexSignInDriver, createSystemCodexReadiness } from './readiness'
import { openCodexSessionChannel } from './session/codex-session-channel'
import { createCodexSessionDiscovery } from './session/codex-session-discovery'
import { hasCodexSessionTurn, readCodexSessionHistory } from './session/codex-session-history'

export function createCodexRegistration(
  client: CodexAppServerClient,
): HarnessRegistration<'codex'> {
  const { request } = client
  const codexHome = process.env.CODEX_HOME ?? path.join(os.homedir(), '.codex')
  return {
    harness: 'codex',
    sessionDiscovery: createCodexSessionDiscovery(request),
    checkReadiness: createSystemCodexReadiness(),
    signIn: createCodexSignInDriver(),
    readCatalog: () => readCodexHarnessInfo(request),
    readHistory: ({ nativeId, subagentId }) =>
      readCodexSessionHistory(request, subagentId ?? nativeId),
    hasTurn: (nativeId, turnId) => hasCodexSessionTurn(request, nativeId, turnId),
    openLiveSession: (input, controls, emit) =>
      openCodexSessionChannel(input, client, { emit, controls }),
    watchHistory: ({ nativeId, subagentId }, invalidate) =>
      watchVendorHistory(path.join(codexHome, 'sessions'), subagentId ?? nativeId, invalidate),
    changeableTurnSettings: ['model', 'effort'],
    acceptsAttachments: true,
    autoCompactLimit: {
      read: () => readAutoCompactLimit(codexHome),
      write: (limit) => writeAutoCompactLimit(codexHome, limit),
    },
    shutdown: () => client.shutdown(),
  }
}
