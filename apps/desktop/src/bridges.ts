// Wiring every renderer bridge to a fresh window, split out of `main.ts` to stay under the
// per-function line cap: one driver setup, then one `attach*` call per domain.
import os from 'node:os'
import { app, type BrowserWindow, shell } from 'electron'
import { attachCodexCompactionBridge } from '@/agents/codex/compaction/bridge'
import { createAccountAccess } from '@/domains/accounts/main/access'
import { attachAccountBridge } from '@/domains/accounts/main/bridge'
import { safeStorageCipher } from '@/domains/accounts/main/safe-storage'
import { attachProjectBridge } from '@/domains/projects/main/bridge'
import type { SetupDocumentSource } from '@/domains/projects/main/setup/setup-bundle'
import type { ProjectStore } from '@/domains/projects/main/sqlite-store'
import {
  attachSessions,
  createSessionDrivers,
  watchClaudeCompactions,
} from '@/domains/sessions/main/session-bridges'
import { attachTicketBridge } from '@/domains/tickets/main/bridge'
import type { SessionTicketLinkStore } from '@/domains/tickets/main/session-links'
import { attachAppearanceBridge } from '@/platform/main/appearance'
import { attachWindowNavigation } from '@/platform/main/security/window-navigation'
import { providerEndpoints } from '@/providers/endpoints'

export function attachBridges(
  window: BrowserWindow,
  request: {
    userData: string
    accountData: string
    connectionData: string
    projects: ProjectStore
    ticketLinks: SessionTicketLinkStore
    rendererURL: string
    proofEnabled: boolean
    setupDocumentSource: SetupDocumentSource
    acceptance: boolean
  },
) {
  const {
    userData,
    accountData,
    connectionData,
    projects,
    ticketLinks,
    rendererURL,
    proofEnabled,
  } = request
  // The CLIs Argo spawns find their stores through HOME; Electron's home path on macOS ignores HOME (#2356).
  const home = os.homedir()
  const drivers = createSessionDrivers(userData, home, proofEnabled)
  // A proof or acceptance run leaves the person's hooks and compaction starts alone.
  const compactionStarts =
    proofEnabled || request.acceptance ? undefined : watchClaudeCompactions(home)
  attachWindowNavigation(window)
  attachProjectBridge(window, {
    projects,
    rendererURL,
    setupDocumentSource: request.setupDocumentSource,
  })
  attachSessions(window, { rendererURL, home, userData, drivers, ticketLinks, compactionStarts })
  attachAppearanceBridge(window, { userData, rendererURL })
  attachCodexCompactionBridge(window, { home, rendererURL })
  const access = createAccountAccess({
    userData,
    accountData,
    connectionData,
    endpoints: providerEndpoints(proofEnabled),
    cipher: safeStorageCipher,
    openExternal: (url) => shell.openExternal(url),
    projects,
  })
  attachAccountBridge(window, { access, rendererURL })
  attachTicketBridge(window, { access, rendererURL })
  app.once('before-quit', () => {
    ticketLinks.close()
    drivers.claude.close()
    drivers.codex.close()
  })
}
