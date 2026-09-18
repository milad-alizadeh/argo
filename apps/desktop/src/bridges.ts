// Wiring every renderer bridge to a fresh window, split out of `main.ts` to stay under the
// per-function line cap: one driver setup, then one `attach*` call per domain.
import os from 'node:os'
import { app, type BrowserWindow, shell } from 'electron'
import {
  attachSessions,
  createSessionDrivers,
  watchClaudeCompactions,
} from '@/domains/sessions/main/session-bridges'
import { attachCodexCompactionBridge } from './agents/codex/compaction/bridge'
import { createAccountAccess } from './core/accounts/access'
import { attachAccountBridge } from './core/accounts/bridge'
import { safeStorageCipher } from './core/accounts/safe-storage'
import { attachAppearanceBridge } from './core/appearance/bridge'
import { attachWindowNavigation } from './core/security/window-navigation'
import { attachTicketBridge } from './core/tickets/bridge'
import { attachProjectBridge } from './domains/projects/main/bridge'
import type { ProjectStore } from './domains/projects/main/sqlite-store'
import { providerEndpoints } from './providers/endpoints'

export function attachBridges(
  window: BrowserWindow,
  request: {
    userData: string
    accountData: string
    projects: ProjectStore
    rendererURL: string
    proofEnabled: boolean
    acceptance: boolean
  },
) {
  const { userData, accountData, projects, rendererURL, proofEnabled } = request
  // The CLIs Argo spawns find their stores through HOME; Electron's home path on macOS ignores HOME (#2356).
  const home = os.homedir()
  const drivers = createSessionDrivers(userData, home, proofEnabled)
  // A proof or acceptance run leaves the person's hooks and compaction starts alone.
  const compactionStarts =
    proofEnabled || request.acceptance ? undefined : watchClaudeCompactions(home)
  attachWindowNavigation(window)
  attachProjectBridge(window, { projects, rendererURL })
  attachSessions(window, { rendererURL, home, userData, drivers, compactionStarts })
  attachAppearanceBridge(window, { userData, rendererURL })
  attachCodexCompactionBridge(window, { home, rendererURL })
  const access = createAccountAccess({
    userData,
    accountData,
    endpoints: providerEndpoints(proofEnabled),
    cipher: safeStorageCipher,
    openExternal: (url) => shell.openExternal(url),
    projects,
  })
  attachAccountBridge(window, { access, rendererURL })
  attachTicketBridge(window, { access, rendererURL })
  app.once('before-quit', () => {
    drivers.claude.close()
    drivers.codex.close()
  })
}
