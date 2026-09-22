// Wiring every renderer bridge to a fresh window, split out of `main.ts` to stay under the
// per-function line cap: one driver setup, then one `attach*` call per domain.
import os from 'node:os'
import { app, type BrowserWindow, shell } from 'electron'
import { createAccountAccess } from '@/domains/accounts/main/access'
import { attachAccountBridge } from '@/domains/accounts/main/bridge'
import { safeStorageCipher } from '@/domains/accounts/main/safe-storage'
import { createConnectionPort } from '@/domains/connections/main'
import { attachHarnessSignInBridge } from '@/domains/harness-signin/main/bridge'
import { createProjectPort } from '@/domains/projects/main'
import { attachProjectBridge } from '@/domains/projects/main/bridge'
import type { OnboardingAgentDriver } from '@/domains/projects/main/setup/onboarding-agent/runtime/run-onboarding-agent'
import type { SetupDocumentSource } from '@/domains/projects/main/setup/preparation/setup-bundle'
import type { ProjectStore } from '@/domains/projects/main/sqlite-store'
import { attachTicketBridge } from '@/domains/tickets/main/bridge'
import type { SessionTicketLinkStore } from '@/domains/tickets/main/session-links'
import { createHarnessReadinessRegistrations } from '@/harnesses/composition/registered-harness-readiness'
import { attachManagedSessionHarnesses } from '@/managed-session-bridges'
import { attachAppearanceBridge } from '@/platform/main/appearance'
import { attachWindowNavigation } from '@/platform/main/security/window-navigation'
import type { DurableDatabase } from '@/platform/main/storage/durable-database'
import { accountProviders, ticketSources } from '@/providers/composition'
import { providerEndpoints } from '@/providers/endpoints'

export function attachBridges(
  window: BrowserWindow,
  request: {
    userData: string
    accountData: string
    connectionData: string
    database: DurableDatabase
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
  attachWindowNavigation(window)
  const { harnesses, managedSessions } = attachManagedSessionHarnesses(window, {
    acceptance: request.acceptance,
    database: request.database,
    home,
    projects,
    proofEnabled,
    rendererURL,
    ticketLinks,
    userData,
  })
  const onboardingHarness = harnesses.find((harness) => harness.harness === 'claude')
  const onboardingDriver = onboardingDriverFrom(onboardingHarness?.onboardingDriver)
  attachProjectBridge(window, {
    projects,
    rendererURL,
    setupDocumentSource: request.setupDocumentSource,
    onboardingDriver,
  })
  attachAppearanceBridge(window, { userData, rendererURL })
  for (const harness of harnesses) harness.attachSettingsBridge?.(window, { home, rendererURL })
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
  attachHarnessSignIn(window, { rendererURL, proofEnabled })
  attachTicketBridge(window, {
    access,
    connections: createConnectionPort({
      path: access.paths.connections,
      exclusive: access.exclusive,
    }),
    rendererURL,
    sources: ticketSources,
  })
  attachBridgeShutdown({ harnesses, managedSessions, ticketLinks })
}

function attachBridgeShutdown(options: {
  harnesses: ReturnType<typeof attachManagedSessionHarnesses>['harnesses']
  managedSessions: ReturnType<typeof attachManagedSessionHarnesses>['managedSessions']
  ticketLinks: SessionTicketLinkStore
}) {
  // `once` removes this listener before it runs, so the `app.quit()` it triggers below proceeds
  // straight to quitting rather than re-entering here (#2494: a killed PTY's exit lands
  // asynchronously, and quitting before it does can abort the process).
  app.once('before-quit', (event) => {
    event.preventDefault()
    options.ticketLinks.close()
    options.managedSessions.close()
    void Promise.all(options.harnesses.map((harness) => harness.close())).then(() => app.quit())
  })
}

function attachHarnessSignIn(
  window: BrowserWindow,
  options: { rendererURL: string; proofEnabled: boolean },
) {
  attachHarnessSignInBridge(window, {
    registrations: createHarnessReadinessRegistrations({ proofEnabled: options.proofEnabled }),
    rendererURL: options.rendererURL,
    proofEnabled: options.proofEnabled,
  })
}

function onboardingDriverFrom(driver: unknown): OnboardingAgentDriver {
  if (isOnboardingAgentDriver(driver)) return driver
  throw new Error('The registered Claude driver cannot run onboarding.')
}

function isOnboardingAgentDriver(driver: unknown): driver is OnboardingAgentDriver {
  return (
    typeof driver === 'object' &&
    driver !== null &&
    'start' in driver &&
    'send' in driver &&
    'liveMessages' in driver &&
    'interrupt' in driver &&
    'pendingPermission' in driver &&
    'decidePermission' in driver &&
    typeof driver.start === 'function' &&
    typeof driver.send === 'function' &&
    typeof driver.liveMessages === 'function' &&
    typeof driver.interrupt === 'function' &&
    typeof driver.pendingPermission === 'function' &&
    typeof driver.decidePermission === 'function'
  )
}
