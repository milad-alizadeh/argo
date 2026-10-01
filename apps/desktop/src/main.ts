import { mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, type BrowserWindow, dialog, net, protocol, shell } from 'electron'
import { z } from 'zod'
import { type Database, openDatabase } from '@/database/database'
import { createAccountAccess, createAccountProcedureContext } from '@/domains/accounts/main'
import { safeStorageCipher } from '@/domains/accounts/main/safe-storage'
import { createConnectionPort } from '@/domains/connections/main'
import {
  createHarnessSignInProcedureContext,
  harnessSignInExpiresAfterMs,
} from '@/domains/harness-signin/main'
import { ATTACHMENT_SCHEME, attachmentPathFromUrl } from '@/domains/sessions/api/attachment-url'
import { sessionLiveEventBodySchema } from '@/domains/sessions/api/session-live-event'
import {
  clearWorkingStatuses,
  ExternalSessionHooks,
  ExternalSessionPoll,
  listComposerCommandsFor,
  SessionListChanges,
  watchSessionList,
} from '@/domains/sessions/main/api'
import {
  markUnresolvedSessionCommandsUnknown,
  reconcileUnknownSessionCommands,
} from '@/domains/sessions/main/database'
import { SessionFeedReaders } from '@/domains/sessions/main/feed'
import {
  type LiveSessionSupervisorActor,
  liveSessionActorFor,
  SessionEventJournal,
  SessionInteractionBroker,
} from '@/domains/sessions/main/live'
import type { SessionSyncSupervisorActor } from '@/domains/sessions/main/sync'
import {
  failInterruptedTicketSearches,
  markInterruptedTicketScans,
} from '@/domains/tickets/main/database'
import type { PriorityRequest, StatusRequest } from '@/domains/tickets/main/operations'
import {
  accountForScopeFrom,
  changeTicketPriority,
  changeTicketStatus,
  markUnresolvedTicketWriteIntentsUncertain,
  reconcileTicketWriteIntents,
  type TicketOperationSupervisorActor,
  ticketWriter,
} from '@/domains/tickets/main/operations'
import {
  reportWindowVisibility,
  TicketChanges,
  type TicketSyncSupervisorCommand,
  ticketByIdReader,
  ticketPageReader,
  ticketSyncTiming,
} from '@/domains/tickets/main/sync'
import { projectTicketScope } from '@/domains/tickets/main/ticket-connection'
import { ensureManagedWorkspace } from '@/domains/workspaces/main/workspace-create-managed'
import { harnessSchema } from '@/harnesses/harness'
import { createHarnessRegistry, type HarnessRegistry } from '@/harnesses/registry'
import { LIVE_EVENT_PROOF_ENV, PROJECT_PROOF_STORE_ENV } from '@/platform/contract/project-proof'
import { attachAppearanceWatch } from '@/platform/main/appearance'
import type { AppActor } from '@/platform/main/application/app-machine'
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
import type { CatalogActor } from '@/platform/main/harness-catalog/catalog-read'
import { platformText } from '@/platform/main/i18n'
import { installMenu } from '@/platform/main/menu'
import { attachWindowNavigation } from '@/platform/main/security/window-navigation'
import { createWriteQueue } from '@/platform/main/storage/portable-file'
import { createAppRouter } from '@/platform/main/trpc-router'
import { attachTrpcTransport } from '@/platform/main/trpc-transport'
import { createDesktopWindow } from '@/platform/main/window/create-window'
import { providerEndpoints } from '@/providers/endpoints'
import { PROVIDER_REGISTRY } from '@/providers/registry'
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
let harnessRegistry: HarnessRegistry | undefined

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

async function chooseAttachmentFiles(window: BrowserWindow): Promise<string[]> {
  const chosen = await dialog.showOpenDialog(window, {
    title: platformText('dialog.attachFiles.title'),
    buttonLabel: platformText('dialog.attachFiles.confirm'),
    properties: ['openFile', 'openDirectory', 'multiSelections'],
  })
  return chosen.canceled ? [] : chosen.filePaths
}

// Account access and the Connection store, created once: the Ticket scans and every window share them.
function createTicketServices(database: Database) {
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
    providers: PROVIDER_REGISTRY,
    cipher: safeStorageCipher,
    openExternal: (url) => shell.openExternal(url).then(() => undefined),
    database,
  })
  const connections = createConnectionPort({
    path: access.paths.connections,
    exclusive: access.exclusive,
  })
  return { access, connections, changes: new TicketChanges() }
}

type TicketServices = ReturnType<typeof createTicketServices>

function createDomainContexts(services: TicketServices, registry: HarnessRegistry) {
  const { access, connections } = services
  return {
    access,
    accounts: createAccountProcedureContext(access),
    connections,
    harnessSignIn: createHarnessSignInProcedureContext(Object.values(registry), {
      expiresAfterMs: harnessSignInExpiresAfterMs(PROOF_ENABLED),
    }),
  }
}

function routerForWindow(options: {
  window: BrowserWindow
  database: Database
  actors: WindowActors
  domains: ReturnType<typeof createDomainContexts>
  registry: HarnessRegistry
  sessionServices: SessionServices
}) {
  const { window, database, actors, domains, registry, sessionServices } = options
  const exclusive = createWriteQueue()
  return createAppRouter({
    accounts: domains.accounts,
    autoCompactLimit: (harness) => registry[harness].autoCompactLimit,
    catalog: actors.catalog,
    harnessSignIn: domains.harnessSignIn,
    projects: {
      database,
      chooseFolder: () => chooseProjectFolder(window),
      exclusive,
    },
    sessions: {
      database,
      ensureManagedWorkspace: (projectId, draftId) =>
        exclusive(() =>
          ensureManagedWorkspace({
            database,
            projectId,
            draftId,
            worktreeRoot: path.join(app.getPath('userData'), 'worktrees'),
          }),
        ),
      rename: ({ harness, nativeId, title }) => {
        const rename = registry[harness].rename
        if (rename === undefined) throw new Error(`${harness} Session renaming is unavailable.`)
        return rename(nativeId, title)
      },
      supervisor: actors.sessions,
      changes: sessionListChanges,
      ticketSource: (projectId) => projectTicketScope(domains.connections, projectId),
      readers: sessionServices.readers,
      acceptsAttachments: (harness) => registry[harness].acceptsAttachments,
      chooseAttachmentFiles: () => chooseAttachmentFiles(window),
      interactions: currentSessionInteractionBroker(),
      listComposerCommands: ({ harness, cwd }) => listComposerCommandsFor(registry[harness], cwd),
      refreshSessionSync: () => actors.sessionSync.send({ type: 'Refresh' }),
      sessionSync: actors.sessionSync,
    },
    tickets: ticketProcedureContext({ database, actors, domains }),
    workspaces: { database, exclusive },
  })
}

function ticketProcedureContext({
  database,
  actors,
  domains,
}: {
  database: Database
  actors: WindowActors
  domains: ReturnType<typeof createDomainContexts>
}) {
  return {
    access: domains.access,
    connections: domains.connections,
    providers: PROVIDER_REGISTRY,
    index: {
      database,
      changes: currentTicketServices().changes,
      send: (command: TicketSyncSupervisorCommand) => actors.ticketSync.send(command),
      changeStatus: (request: StatusRequest) =>
        changeTicketStatus(actors.ticketOperations, request),
      changePriority: (request: PriorityRequest) =>
        changeTicketPriority(actors.ticketOperations, request),
    },
  }
}

function currentTicketServices(): TicketServices {
  if (ticketServices === undefined) throw new Error('Ticket services are unavailable.')
  return ticketServices
}

// Every write intent left uncertain by the last process, settled by reading its Ticket's native ID.
async function reconcileTicketWriteIntentsAtStartup(database: Database): Promise<void> {
  const { access, connections, changes } = currentTicketServices()
  const read = await connections.read()
  await reconcileTicketWriteIntents({
    database,
    readTicket: ticketByIdReader({ access, providers: PROVIDER_REGISTRY }),
    accountForScope: accountForScopeFrom(read.ok ? read.document.connections : []),
    changed: changes.changed,
  })
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
  sessions: LiveSessionSupervisorActor
  sessionSync: SessionSyncSupervisorActor
  ticketSync: {
    send: (event: TicketSyncSupervisorCommand) => void
  }
  ticketOperations: Pick<TicketOperationSupervisorActor, 'send'>
}

function requireWindowActors(actor: AppActor): WindowActors {
  const catalog = actor.system.get('catalog') as CatalogActor | undefined
  const sessions = actor.system.get('sessions') as LiveSessionSupervisorActor | undefined
  const sessionSync = actor.system.get('sessionSync') as SessionSyncSupervisorActor | undefined
  const ticketSync = actor.system.get('ticketSync') as
    | {
        send: (event: TicketSyncSupervisorCommand) => void
      }
    | undefined
  const ticketOperations = actor.system.get('ticketOperations') as
    | Pick<TicketOperationSupervisorActor, 'send'>
    | undefined
  if (
    catalog === undefined ||
    sessions === undefined ||
    sessionSync === undefined ||
    ticketSync === undefined ||
    ticketOperations === undefined
  )
    throw new Error('Application child actors are unavailable.')
  return { catalog, sessions, sessionSync, ticketSync, ticketOperations }
}

function attachWindowTrpc({
  window,
  rendererURL,
  actors,
  domains,
  database,
  registry,
  sessionServices,
}: {
  window: BrowserWindow
  rendererURL: string
  actors: WindowActors
  domains: ReturnType<typeof createDomainContexts>
  database: Database
  registry: HarnessRegistry
  sessionServices: SessionServices
}): () => void {
  const router = routerForWindow({
    actors,
    domains,
    window,
    database,
    registry,
    sessionServices,
  })
  return attachTrpcTransport({ window, rendererURL, router, context: undefined })
}

function liveChannelCheck(actors: WindowActors) {
  return (sessionId: string) => {
    const session = liveSessionActorFor(actors.sessions, sessionId)
    return (
      session !== undefined &&
      !session.getSnapshot().matches('Failed') &&
      !session.getSnapshot().matches('Closed')
    )
  }
}

// The Session services the app runs once, not per window: one set of Feed readers, the Session
// List's live status announcements, and the stored rows of Sessions that run outside Argo.
function startSessionServices(actors: WindowActors, database: Database, registry: HarnessRegistry) {
  const context = { database, changes: sessionListChanges }
  const hasLiveChannel = liveChannelCheck(actors)
  const readers = new SessionFeedReaders({
    ...context,
    journal: currentSessionEventJournal(),
    hasLiveChannel,
    readHistory: (harness, target) => registry[harness].readHistory(target),
  })
  const harnesses = harnessSchema.options.flatMap((harness) => {
    const external = registry[harness].externalSessions
    return external === undefined ? [] : [{ harness, external }]
  })
  const externalSessions = new ExternalSessionPoll({
    ...context,
    harnesses,
    hasLiveChannel,
    discover: ({ harness, nativeId }) =>
      actors.sessionSync.send({ type: 'Discover', harness, nativeId }),
  })
  const stopSessionList = watchSessionList({ ...context, supervisor: actors.sessions })
  externalSessions.start()
  const statusHooks = new ExternalSessionHooks({ poll: externalSessions, harnesses })
  void statusHooks.start()
  return {
    readers,
    stop: () => {
      stopSessionList()
      statusHooks.stop()
      externalSessions.stop()
    },
  }
}

type SessionServices = ReturnType<typeof startSessionServices>

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
  sessionServices?.stop()
  database.$client.close()
}

function createWindow({
  actor,
  database,
  registry,
  sessionServices,
}: {
  actor: AppActor
  database: Database
  registry: HarnessRegistry
  sessionServices: SessionServices
}): void {
  const actors = requireWindowActors(actor)
  actors.sessionSync.send({ type: 'Refresh' })
  const domains = createDomainContexts(currentTicketServices(), registry)
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
        sessionServices,
      })
      attachAppearanceWatch(window)
      reportWindowVisibility(window, actors.ticketSync.send)
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
const sessionListChanges = new SessionListChanges()
let sessionServices: SessionServices | undefined
let sessionEventJournal: SessionEventJournal | undefined
let sessionInteractionBroker: SessionInteractionBroker | undefined
let ticketServices: TicketServices | undefined

async function prepare() {
  const { projectData } = developmentStoreDirectories({
    userData: app.getPath('userData'),
    appData: app.getPath('appData'),
    instance: DEVELOPMENT_INSTANCE,
  })
  applicationDatabase = openDatabase(projectData, { packaged: app.isPackaged })
  clearWorkingStatuses(applicationDatabase)
  markUnresolvedSessionCommandsUnknown(applicationDatabase)
  markInterruptedTicketScans(applicationDatabase)
  failInterruptedTicketSearches(applicationDatabase)
  markUnresolvedTicketWriteIntentsUncertain(applicationDatabase)
  const database = applicationDatabase
  const tickets = createTicketServices(database)
  ticketServices = tickets
  sessionEventJournal = new SessionEventJournal()
  const liveEventProof = process.env[LIVE_EVENT_PROOF_ENV]
  if (PROOF_ENABLED && liveEventProof !== undefined) {
    const events = liveEventProofSchema.parse(JSON.parse(liveEventProof))
    for (const event of events) sessionEventJournal.append(event.sessionId, event.body)
  }
  sessionInteractionBroker = new SessionInteractionBroker()
  if (DEVELOPMENT_INSTANCE) {
    await seedDevelopmentProject(applicationDatabase, DEVELOPMENT_INSTANCE)
  }
  harnessRegistry = createHarnessRegistry()
  return {
    database: applicationDatabase,
    sessionListChanges,
    sessionEventJournal,
    sessionInteractionBroker,
    ticketSync: {
      database,
      readPage: ticketPageReader({ access: tickets.access, providers: PROVIDER_REGISTRY }),
      readTicket: ticketByIdReader({ access: tickets.access, providers: PROVIDER_REGISTRY }),
      changed: tickets.changes.changed,
      timing: ticketSyncTiming(PROOF_ENABLED),
    },
    ticketOperations: {
      database,
      write: ticketWriter({ access: tickets.access, providers: PROVIDER_REGISTRY }),
      changed: tickets.changes.changed,
    },
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
  if (applicationDatabase === undefined) throw new Error('Application services are unavailable.')
  if (harnessRegistry === undefined) throw new Error('Harness registry is unavailable.')
  const registry = harnessRegistry
  void reconcileUnknownSessionCommands(
    applicationDatabase,
    (harness, target) => registry[harness].readHistory(target),
    (harness, nativeId, turnId) =>
      registry[harness].hasTurn?.(nativeId, turnId) ?? Promise.resolve(false),
  ).catch((error) => console.error('Session command recovery failed.', error))
  void reconcileTicketWriteIntentsAtStartup(applicationDatabase).catch((error) =>
    console.error('Ticket write intent recovery failed.', error),
  )
  sessionServices = startSessionServices(requireWindowActors(actor), applicationDatabase, registry)
  createWindow({ actor, database: applicationDatabase, registry, sessionServices })

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
