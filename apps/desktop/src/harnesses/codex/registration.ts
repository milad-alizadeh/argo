import os from 'node:os'
import path from 'node:path'
import { watchVendorHistory } from '@/harnesses/host/history-watch'
import type { HarnessRegistration } from '@/harnesses/registration'
import type { CodexRequest } from './app-server/codex-app-server-client'
import { readCodexHarnessInfo } from './catalog'
import { createCodexSignInDriver, createSystemCodexReadiness } from './readiness'
import { createCodexSessionDiscovery } from './session/codex-session-discovery'
import { readCodexSessionHistory } from './session/codex-session-history'

export function createCodexRegistration(request: CodexRequest): HarnessRegistration<'codex'> {
  return {
    harness: 'codex',
    sessionDiscovery: createCodexSessionDiscovery(request),
    checkReadiness: createSystemCodexReadiness(),
    signIn: createCodexSignInDriver(),
    readCatalog: () => readCodexHarnessInfo(request),
    readHistory: ({ nativeId, subagentId }) =>
      readCodexSessionHistory(request, subagentId ?? nativeId),
    watchHistory: ({ nativeId }, invalidate) =>
      watchVendorHistory(
        path.join(process.env.CODEX_HOME ?? path.join(os.homedir(), '.codex'), 'sessions'),
        nativeId,
        invalidate,
      ),
  }
}
