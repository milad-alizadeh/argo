import os from 'node:os'
import path from 'node:path'
import { watchVendorHistory } from '@/harnesses/host/history-watch'
import type { HarnessRegistration } from '@/harnesses/registration'
import { readCodexHarnessInfo } from './catalog'
import { createCodexSignInDriver, createSystemCodexReadiness } from './readiness'
import type { CodexLiveClient } from './session/codex-session-channel'
import { openCodexSessionChannel } from './session/codex-session-channel'
import { createCodexSessionDiscovery } from './session/codex-session-discovery'
import { hasCodexSessionTurn, readCodexSessionHistory } from './session/codex-session-history'
import { readCodexSessionPage } from './session/codex-session-pages'

export function createCodexRegistration(client: CodexLiveClient): HarnessRegistration<'codex'> {
  const { request } = client
  return {
    harness: 'codex',
    sessionDiscovery: createCodexSessionDiscovery(request),
    checkReadiness: createSystemCodexReadiness(),
    signIn: createCodexSignInDriver(),
    readCatalog: () => readCodexHarnessInfo(request),
    readHistory: ({ nativeId, subagentId }) =>
      readCodexSessionHistory(request, subagentId ?? nativeId),
    readHistoryPage: ({ nativeId, subagentId }, before) =>
      readCodexSessionPage(request, subagentId ?? nativeId, before),
    hasTurn: (nativeId, turnId) => hasCodexSessionTurn(request, nativeId, turnId),
    openLiveSession: (input, controls, emit) =>
      openCodexSessionChannel(input, client, { emit, controls }),
    watchHistory: ({ nativeId, subagentId }, invalidate) =>
      watchVendorHistory(
        path.join(process.env.CODEX_HOME ?? path.join(os.homedir(), '.codex'), 'sessions'),
        subagentId ?? nativeId,
        invalidate,
      ),
  }
}
