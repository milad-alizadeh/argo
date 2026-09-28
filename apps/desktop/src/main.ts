import { mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, type BrowserWindow, dialog, net, protocol, shell } from 'electron'
import type { ActorRefFrom } from 'xstate'
import { z } from 'zod'
import { type Database, openDatabase } from '@/database/database'
import { createAccountAccess, createAccountProcedureContext } from '@/domains/accounts/main'
import { safeStorageCipher } from '@/domains/accounts/main/safe-storage'
import { createConnectionPort } from '@/domains/connections/main'
import { createHarnessSignInProcedureContext } from '@/domains/harness-signin/main'
import { ATTACHMENT_SCHEME, attachmentPathFromUrl } from '@/domains/sessions/api/attachment-url'
import { sessionLiveEventBodySchema } from '@/domains/sessions/api/session-live-event'
import { SessionSyncStatusStore } from '@/domains/sessions/main/api/session-sync-status'
import {
  markUnresolvedSessionCommandsUnknown,
  reconcileUnknownSessionCommands,
} from '@/domains/sessions/main/database/session-command-outcomes'
import {
  type LiveSessionSupervisorActor,
  liveSessionActorFor,
} from '@/domains/sessions/main/live/live-session-supervisor-machine'
import { SessionEventJournal } from '@/domains/sessions/main/live/session-event-journal'
import { SessionInteractionBroker } from '@/domains/sessions/main/live/session-interaction-broker'
import type { SessionSyncSupervisorCommand } from '@/domains/sessions/main/sync/session-sync-supervisor-machine'
import type { CatalogActor } from '@/harnesses/catalog/catalog-read'
import type { CodexLiveClient } from '@/harnesses/codex/session/codex-session-channel'
import { createHarnessRegistry, type HarnessRegistry } from '@/harnesses/registry'
import { LIVE_EVENT_PROOF_ENV, PROJECT_PROOF_STORE_ENV } from '@/platform/contract/project-proof'
import { attachAppearanceWatch } from '@/platform/main/appearance'
import type { AppActor } from '@/platform/main/application/app-machine'
import {
  type codexAppServerMachine,
  observeCodexAppServer,
  requestCodexAppServer,
  respondCodexAppServer,
} from '@/platform/main/application/codex-app-server-machine'
import { startDesktopApplication } from '@/platform/main/application/start'
import {
  DEVELOPMENT_APPLICATION_NAME,
  developmentStoreDirectories,
} from '@/platform/main/development/account-store'
import {
  developmentIdentityArgument,
  developmentInstance,
} from '@/platform/main/development/instance'
import { seedDevelopmentProject } from '@/platform/main/development/project-seed'
import { writeDevelopmentReady } from '@/platform/main/development/ready'
import { platformText } from '@/platform/main/i18n'
import { installMenu } from '@/platform/main/menu'
import { attachWindowNavigation } from '@/platform/main/security/window-navigation'
import { createWriteQueue } from '@/platform/main/storage/portable-file'
import { createAppRouter } from '@/platform/main/trpc-router'
import { attachTrpcTransport } from '@/platform/main/trpc-transport'
import { createDesktopWindow } from '@/platform/main/window/create-window'
import { accountProviders, ticketSources } from '@/providers/composition'
import { providerEndpoints } from '@/providers/endpoints'
import { identifierSchema } from '@/shared/validation'
import { ACCEPTANCE_ENV } from '../scripts/acceptance-protocol.mts'

protocol.registerSchemesAsPrivileged([
  {
    scheme: ATTACHMENT_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
])

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined
declare const MAIN_WINDOW_VITE_NAME: string

// The PTY acceptance boundary (#1749, run against node-pty by #1791) lives in the SHIPPED main
// process behind this flag, because the only place its properties are true or false is inside the
// packaged, signed app: behind the hardened runtime, the asar and the code signature. A dev-server
// run proves none of it. `scripts/prove-packaged-pty.mts` is what drives the packaged binary.
//
// The harness is loaded by a DYNAMIC import, so the 600-cycle loop, the six behaviour cases and
// the `lsof` call are split into a chunk the ordinary launch never touches. A static import would
// put all of it on the path of every user who opens the app.
const ACCEPTANCE_ENABLED = process.env[ACCEPTANCE_ENV] === '1'
const acceptanceUserData = ACCEPTANCE_ENABLED
  ? mkdtempSync(path.join(os.tmpdir(), 'argo-pty-acceptance-'))
  : null
if (acceptanceUserData) app.setPath('userData', acceptanceUserData)

// The Project proof (#1825, extended by #1828) drives the SHIPPED app against its own application
// data, for the same reason the acceptance harness above lives here: a registry write is only
// proved inside the packaged, signed app, and a proof that wrote the real registry would be a
// proof nobody could run twice. It ships as one `app.setPath` and one `show`, and it is read from
// an absolute path so that a stray or empty value cannot silently move a person's Projects.
const projectProofStore = process.env[PROJECT_PROOF_STORE_ENV]
const PROOF_ENABLED = Boolean(projectProofStore && path.isAbsolute(projectProofStore))
if (PROOF_ENABLED && projectProofStore) app.setPath('userData', projectProofStore)
const liveEventProofSchema = z
  .array(z.strictObject({ sessionId: identifierSchema, body: sessionLiveEventBodySchema }))
  .max(500)

// A window that never shows still stands up a GPU/compositor process to paint it, and closing
// that process is where Chromium's shutdown occasionally stalls tens of seconds past a CI
// runner's launch timeout before the SIGKILL that ends #2607's packaged-app hang. Nothing here
// paints a frame a person will see, so there is no compositor to hang on.
if (ACCEPTANCE_ENABLED || PROOF_ENABLED) app.disableHardwareAcceleration()

const DEVELOPMENT_INSTANCE = MAIN_WINDOW_VITE_DEV_SERVER_URL
  ? developmentInstance(process.env)
  : null

if (DEVELOPMENT_INSTANCE) {
  // safeStorage keys belong to an app, so every development worktree must keep one app identity.
  app.setName(DEVELOPMENT_APPLICATION_NAME)
  const ticket = DEVELOPMENT_INSTANCE.label.match(/^#(\d+)$/)?.[1]
  app.dock?.setBadge(ticket ?? '')
  app.setPath('userData', DEVELOPMENT_INSTANCE.userData)
  app.setPath('sessionData', path.join(DEVELOPMENT_INSTANCE.directory, 'session-data'))
  app.commandLine.appendSwitch('remote-debugging-port', String(DEVELOPMENT_INSTANCE.debugPort))
}

let desktopWindow: BrowserWindow | undefined
let focusRequestedBeforeWindowReady = false
let applicationActor: AppActor | undefined
let harnessRegistry: HarnessRegistry | undefined

function codexClient(): CodexLiveClient {
  const actor = () =>
    applicationActor?.system.get('codex') as ActorRefFrom<typeof codexAppServerMachine> | undefined
  return {
    request: (method, params, parse) => {
      const current = actor()
      if (current === undefined)
        return Promise.reject(new Error('Codex app-server actor is unavailable.'))
      return requestCodexAppServer(current)(method, params, parse)
    },
    onNotification: (listener) => {
      const current = actor()
      return current === undefined ? () => {} : observeCodexAppServer(current, listener)
    },
    respond: (id, result) => {
      const current = actor()
      if (current === undefined) throw new Error('Codex app-server actor is unavailable.')
      respondCodexAppServer(current, id, result)
    },
  }
}

function focusWindow(): void {
  if (!desktopWindow) {
    focusRequestedBeforeWindowReady = true
    return
  }
  if (desktopWindow.isMinimized()) desktopWindow.restore()
  if (!desktopWindow.isVisible()) desktopWindow.show()
  desktopWindow.focus()
}

async function chooseProjectFolder(window: BrowserWindow): Promise<string | null> {
  const chosen = await dialog.showOpenDialog(window, {
    title: platformText('dialog.openProject.title'),
    buttonLabel: platformText('dialog.openProject.confirm'),
    properties: ['openDirectory'],
  })
  return chosen.canceled ? null : (chosen.filePaths[0] ?? null)
}

function createDomainContexts(database: Database, registry: HarnessRegistry) {
  const userData = app.getPath('userData')
  const { accountData, connectionData } = developmentStoreDirectories({
    userData,
    appData: app.getPath('appData'),
    instance: DEVELOPMENT_INSTANCE,
  })
  const access = createAccountAccess({
    userData,
    accountData,
    connectionData,
    endpoints: providerEndpoints(PROOF_ENABLED),
    providers: accountProviders,
    cipher: safeStorageCipher,
    openExternal: (url) => shell.openExternal(url).then(() => undefined),
    database,
  })
  return {
    access,
    accounts: createAccountProcedureContext(access),
    connections: createConnectionPort({
      path: access.paths.connections,
      exclusive: access.exclusive,
    }),
    harnessSignIn: createHarnessSignInProcedureContext(Object.values(registry)),
  }
}

function routerForWindow(options: {
  window: BrowserWindow
  database: Database
  actors: {
    catalog: CatalogActor
    codex: ActorRefFrom<typeof codexAppServerMachine>
    sessions: LiveSessionSupervisorActor
    sessionSync: {
      send: (event: SessionSyncSupervisorCommand) => void
    }
  }
  sessionSyncStatus: SessionSyncStatusStore
  domains: ReturnType<typeof createDomainContexts>
  registry: HarnessRegistry
}) {
  const { window, database, actors, domains, sessionSyncStatus, registry } = options
  const exclusive = createWriteQueue()
  return createAppRouter({
    accounts: domains.accounts,
    catalog: actors.catalog,
    harnessSignIn: domains.harnessSignIn,
    projects: {
      database,
      chooseFolder: () => chooseProjectFolder(window),
      exclusive,
    },
    sessions: {
      database,
      readHistory: (harness, target) => registry[harness].readHistory(target),
      readHistoryPage: (harness, target, before) =>
        registry[harness].readHistoryPage?.(target, before) ?? Promise.resolve(null),
      watchHistory: (harness, target, invalidate) =>
        registry[harness].watchHistory?.(target, invalidate) ?? (() => {}),
      rename: ({ harness, nativeId, title }) => {
        const rename = registry[harness].rename
        if (rename === undefined) throw new Error(`${harness} Session renaming is unavailable.`)
        return rename(nativeId, title)
      },
      supervisor: actors.sessions,
      journal: currentSessionEventJournal(),
      interactions: currentSessionInteractionBroker(),
      hasLiveChannel: (sessionId) => {
        const session = liveSessionActorFor(actors.sessions, sessionId)
        return (
          session !== undefined &&
          !session.getSnapshot().matches('Failed') &&
          !session.getSnapshot().matches('Closed')
        )
      },
      refreshSessionSync: () => actors.sessionSync.send({ type: 'Refresh' }),
      sessionSyncStatus,
    },
    tickets: { access: domains.access, connections: domains.connections, sources: ticketSources },
    workspaces: { database, exclusive },
  })
}

function currentSessionSyncStatus(): SessionSyncStatusStore {
  if (sessionSyncStatus === undefined) throw new Error('Session sync status is unavailable.')
  return sessionSyncStatus
}

function currentSessionEventJournal(): SessionEventJournal {
  if (sessionEventJournal === undefined) throw new Error('Session event journal is unavailable.')
  return sessionEventJournal
}

function currentSessionInteractionBroker(): SessionInteractionBroker {
  if (sessionInteractionBroker === undefined)
    throw new Error('Session interaction broker is unavailable.')
  return sessionInteractionBroker
}

type WindowActors = {
  catalog: CatalogActor
  codex: ActorRefFrom<typeof codexAppServerMachine>
  sessions: LiveSessionSupervisorActor
  sessionSync: {
    send: (event: SessionSyncSupervisorCommand) => void
  }
}

function requireWindowActors(actor: AppActor): WindowActors {
  const catalog = actor.system.get('catalog') as CatalogActor | undefined
  const codex = actor.system.get('codex') as ActorRefFrom<typeof codexAppServerMachine> | undefined
  const sessions = actor.system.get('sessions') as LiveSessionSupervisorActor | undefined
  const sessionSync = actor.system.get('sessionSync') as
    | {
        send: (event: SessionSyncSupervisorCommand) => void
      }
    | undefined
  if (
    catalog === undefined ||
    codex === undefined ||
    sessions === undefined ||
    sessionSync === undefined
  )
    throw new Error('Application child actors are unavailable.')
  return { catalog, codex, sessions, sessionSync }
}

function attachWindowTrpc({
  window,
  rendererURL,
  actors,
  domains,
  database,
  registry,
}: {
  window: BrowserWindow
  rendererURL: string
  actors: WindowActors
  domains: ReturnType<typeof createDomainContexts>
  database: Database
  registry: HarnessRegistry
}): () => void {
  const router = routerForWindow({
    actors,
    domains,
    sessionSyncStatus: currentSessionSyncStatus(),
    window,
    database,
    registry,
  })
  return attachTrpcTransport({ window, rendererURL, router, context: undefined })
}

function closeDesktopWindow({
  actor,
  database,
  domains,
  detachTrpc,
}: {
  actor: AppActor
  database: Database
  domains: ReturnType<typeof createDomainContexts>
  detachTrpc: () => void
}): void {
  desktopWindow = undefined
  detachTrpc()
  domains.accounts.signIn.dispose()
  domains.harnessSignIn.signIn.dispose()
  actor.send({ type: 'Shutdown' })
  database.$client.close()
}

function createWindow(actor: AppActor, database: Database, registry: HarnessRegistry): void {
  const actors = requireWindowActors(actor)
  actors.sessionSync.send({ type: 'Refresh' })
  const domains = createDomainContexts(database, registry)
  desktopWindow = createDesktopWindow({
    buildDirectory: __dirname,
    rendererName: MAIN_WINDOW_VITE_NAME,
    developmentServerURL: MAIN_WINDOW_VITE_DEV_SERVER_URL,
    title: DEVELOPMENT_INSTANCE?.title,
    show: !ACCEPTANCE_ENABLED && !PROOF_ENABLED,
    additionalArguments: DEVELOPMENT_INSTANCE
      ? [
          developmentIdentityArgument({
            id: DEVELOPMENT_INSTANCE.id,
            label: DEVELOPMENT_INSTANCE.label,
            title: DEVELOPMENT_INSTANCE.title,
            worktree: DEVELOPMENT_INSTANCE.worktree,
          }),
        ]
      : undefined,
    attach: (window, rendererURL) => {
      attachWindowNavigation(window)
      const detachTrpc = attachWindowTrpc({
        window,
        rendererURL,
        actors,
        domains,
        database,
        registry,
      })
      attachAppearanceWatch(window)
      window.once('closed', () => closeDesktopWindow({ actor, database, domains, detachTrpc }))
      installMenu(window)
    },
    loaded: (window) => {
      void writeDevelopmentReady(DEVELOPMENT_INSTANCE, window)
    },
  })
  if (focusRequestedBeforeWindowReady) {
    focusRequestedBeforeWindowReady = false
    focusWindow()
  }
}

let applicationDatabase: Database | undefined
let sessionSyncStatus: SessionSyncStatusStore | undefined
let sessionEventJournal: SessionEventJournal | undefined
let sessionInteractionBroker: SessionInteractionBroker | undefined
let codexSessionSyncStatus: SessionSyncStatusStore | undefined

async function prepare() {
  const { projectData } = developmentStoreDirectories({
    userData: app.getPath('userData'),
    appData: app.getPath('appData'),
    instance: DEVELOPMENT_INSTANCE,
  })
  applicationDatabase = openDatabase(projectData, { packaged: app.isPackaged })
  markUnresolvedSessionCommandsUnknown(applicationDatabase)
  sessionSyncStatus = new SessionSyncStatusStore(applicationDatabase)
  sessionEventJournal = new SessionEventJournal()
  const liveEventProof = process.env[LIVE_EVENT_PROOF_ENV]
  if (PROOF_ENABLED && liveEventProof !== undefined) {
    const events = liveEventProofSchema.parse(JSON.parse(liveEventProof))
    for (const event of events) sessionEventJournal.append(event.sessionId, event.body)
  }
  sessionInteractionBroker = new SessionInteractionBroker()
  codexSessionSyncStatus = new SessionSyncStatusStore(applicationDatabase, 'codex')
  if (DEVELOPMENT_INSTANCE) {
    await seedDevelopmentProject(applicationDatabase, DEVELOPMENT_INSTANCE)
  }
  harnessRegistry = createHarnessRegistry(codexClient())
  return {
    database: applicationDatabase,
    sessionSyncStatus,
    codexSessionSyncStatus,
    sessionEventJournal,
    sessionInteractionBroker,
    registry: harnessRegistry,
  }
}

async function ready(actor: AppActor): Promise<void> {
  // Main-process `net.fetch` reads `file://` directly, unlike a renderer's own subresource
  // requests, so this is immune to the restriction the scheme itself exists to route around.
  protocol.handle(ATTACHMENT_SCHEME, (request) => {
    const filePath = attachmentPathFromUrl(request.url)
    return filePath ? net.fetch(pathToFileURL(filePath).href) : new Response(null, { status: 400 })
  })
  if (applicationDatabase === undefined || sessionSyncStatus === undefined)
    throw new Error('Application services are unavailable.')
  applicationActor = actor
  if (harnessRegistry === undefined) throw new Error('Harness registry is unavailable.')
  const registry = harnessRegistry
  void reconcileUnknownSessionCommands(
    applicationDatabase,
    (harness, target) => registry[harness].readHistory(target),
    (harness, nativeId, turnId) =>
      registry[harness].hasTurn?.(nativeId, turnId) ?? Promise.resolve(false),
  ).catch((error) => console.error('Session command recovery failed.', error))
  createWindow(actor, applicationDatabase, registry)

  if (ACCEPTANCE_ENABLED) {
    // A window is open and a PTY may still be draining, so this run also stands as the app-shutdown
    // case: the driver outside fails the build if the process does not go away on its own.
    void (async () => {
      try {
        const { reportAcceptance, runAcceptance } = await import(
          '@/platform/main/pty-acceptance/pty-acceptance'
        )
        const result = await runAcceptance(os.homedir())
        await reportAcceptance(result)
        if (result.ok) app.quit()
        else app.exit(1)
      } catch (error) {
        console.error(error)
        app.exit(1)
      }
    })()
  }
}

startDesktopApplication({
  prepare,
  ready,
  focusExistingWindow: focusWindow,
  willQuit: () => {
    if (DEVELOPMENT_INSTANCE) void rm(DEVELOPMENT_INSTANCE.readyFile, { force: true })
    if (acceptanceUserData) void rm(acceptanceUserData, { recursive: true, force: true })
  },
})
