// Wiring every renderer bridge to a fresh window, split out of `main.ts` to stay under the
// per-function line cap: one driver setup, then one `attach*` call per domain.
import os from 'node:os'
import { app, type BrowserWindow, shell } from 'electron'
import { createAccountAccess } from '@/domains/accounts/main/access'
import { attachAccountBridge } from '@/domains/accounts/main/bridge'
import { safeStorageCipher } from '@/domains/accounts/main/safe-storage'
import { createConnectionPort } from '@/domains/connections/main/port'
import { attachProjectBridge } from '@/domains/projects/main/bridge'
import { createProjectPort } from '@/domains/projects/main/port'
import type { SetupDocumentSource } from '@/domains/projects/main/setup/setup-bundle'
import type { ProjectStore } from '@/domains/projects/main/sqlite-store'
import { attachTicketBridge } from '@/domains/tickets/main/bridge'
import type { SessionTicketLinkStore } from '@/domains/tickets/main/session-links'
import { attachCodexCompactionBridge } from '@/harnesses/codex/compaction/bridge'
import {
  attachSessions,
  closeSessionDrivers,
  createSessionDrivers,
  watchClaudeCompactions,
} from '@/harnesses/composition/session-bridges'
import { attachAppearanceBridge } from '@/platform/main/appearance'
import { attachWindowNavigation } from '@/platform/main/security/window-navigation'
import { accountProviders, ticketSources } from '@/providers/composition'
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
  const drivers = createSessionDrivers({ userData, home, proofEnabled })
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
    providers: accountProviders,
    cipher: safeStorageCipher,
    openExternal: (url) => shell.openExternal(url),
    projects: createProjectPort(projects),
  })
  attachAccountBridge(window, { access, rendererURL })
  attachTicketBridge(window, {
    access,
    connections: createConnectionPort({
      path: access.paths.connections,
      exclusive: access.exclusive,
    }),
    rendererURL,
    sources: ticketSources,
  })
  // `once` removes this listener before it runs, so the `app.quit()` it triggers below proceeds
  // straight to quitting rather than re-entering here (#2494: a killed PTY's exit lands
  // asynchronously, and quitting before it does can abort the process).
  app.once('before-quit', (event) => {
    event.preventDefault()
    ticketLinks.close()
    void closeSessionDrivers(drivers).then(() => app.quit())
  })
}
