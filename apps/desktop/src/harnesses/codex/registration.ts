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
  }
}
