import { mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, type BrowserWindow, net, protocol } from 'electron'
import type { ActorRefFrom } from 'xstate'
import { seedDevelopmentProject } from '@/domains/projects/main/development-seed'
import { openProjectStore } from '@/domains/projects/main/main-store'
import { PROJECT_PROOF_STORE_ENV } from '@/domains/projects/main/proof-protocol'
import {
  ATTACHMENT_SCHEME,
  attachmentPathFromUrl,
} from '@/domains/sessions/contract/model/feed/feed-images'
import type { SessionSupervisorActor } from '@/domains/sessions/main/live/session-supervisor-machine'
import type { sessionSyncMachine } from '@/domains/sessions/main/sync/session-sync-machine'
import type { CatalogActor } from '@/harnesses/catalog/catalog-read'
import type { codexAppServerMachine } from '@/harnesses/codex/app-server/codex-app-server-machine'
import { openDurableStores } from '@/main/durable-stores'
import { WATCHED_CHANGED_CHANNEL } from '@/platform/contract/watch'
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
import { writeDevelopmentReady } from '@/platform/main/development/ready'
import { resetIncompleteDevelopmentDatabase } from '@/platform/main/development/reset-incomplete-database'
import { installMenu } from '@/platform/main/menu'
import { attachWindowNavigation } from '@/platform/main/security/window-navigation'
import { configureStorageRuntime } from '@/platform/main/storage/storage-runtime'
import { createAppRouter } from '@/platform/main/trpc-router'
import { attachTrpcTransport } from '@/platform/main/trpc-transport'
import { createDesktopWindow } from '@/platform/main/window/create-window'
import { ACCEPTANCE_ENV } from '../scripts/acceptance-protocol.mts'

protocol.registerSchemesAsPrivileged([
  {
    scheme: ATTACHMENT_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
])

configureStorageRuntime(app.isPackaged)

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

function focusWindow(): void {
  if (!desktopWindow) {
    focusRequestedBeforeWindowReady = true
    return
  }
  if (desktopWindow.isMinimized()) desktopWindow.restore()
  if (!desktopWindow.isVisible()) desktopWindow.show()
  desktopWindow.focus()
}

function watchSessionSync(
  window: BrowserWindow,
  sync: ActorRefFrom<typeof sessionSyncMachine> | undefined,
) {
  return sync?.subscribe(() => window.webContents.send(WATCHED_CHANGED_CHANNEL, 'sessions'))
}

function watchLiveSessions(window: BrowserWindow, supervisor: SessionSupervisorActor | undefined) {
  if (supervisor === undefined) return () => {}
  const children = new Map<string, { unsubscribe: () => void }>()
  const changed = () => window.webContents.send(WATCHED_CHANGED_CHANNEL, 'sessions')
  const parent = supervisor.subscribe((snapshot) => {
    const current = snapshot.context.sessions
    for (const [id, subscription] of children) {
      if (current[id] !== undefined) continue
      subscription.unsubscribe()
      children.delete(id)
    }
    for (const [id, session] of Object.entries(current)) {
      if (children.has(id)) continue
      children.set(id, session.subscribe(changed))
    }
    changed()
  })
  return () => {
    parent.unsubscribe()
    for (const subscription of children.values()) subscription.unsubscribe()
  }
}

function routerForApplication(actor: AppActor, stores: ReturnType<typeof openDurableStores>) {
  const catalogActor = actor.system.get('catalog') as CatalogActor | undefined
  const sessionsActor = actor.system.get('sessions') as SessionSupervisorActor | undefined
  const codexActor = actor.system.get('codex') as
    | ActorRefFrom<typeof codexAppServerMachine>
    | undefined
  const claudeSync = actor.system.get('claudeSync') as
    | ActorRefFrom<typeof sessionSyncMachine>
    | undefined
  const codexSync = actor.system.get('codexSync') as
    | ActorRefFrom<typeof sessionSyncMachine>
    | undefined
  if (
    catalogActor === undefined ||
    sessionsActor === undefined ||
    codexActor === undefined ||
    claudeSync === undefined ||
    codexSync === undefined
  )
    throw new Error('Application child actors are unavailable.')
  return createAppRouter({
    actor: catalogActor,
    sessions: sessionsActor,
    database: stores.database,
    codex: codexActor,
    sync: { claude: claudeSync, codex: codexSync },
  })
}

function createWindow(actor: AppActor, stores: ReturnType<typeof openDurableStores>): void {
  const claudeSync = actor.system.get('claudeSync') as
    | ActorRefFrom<typeof sessionSyncMachine>
    | undefined
  const codexSync = actor.system.get('codexSync') as
    | ActorRefFrom<typeof sessionSyncMachine>
    | undefined
  const sessions = actor.system.get('sessions') as SessionSupervisorActor | undefined
  const router = routerForApplication(actor, stores)
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
      const detachTrpc = attachTrpcTransport({
        window,
        rendererURL,
        router,
        context: undefined,
      })
      attachAppearanceWatch(window)
      const claudeWatch = watchSessionSync(window, claudeSync)
      const codexWatch = watchSessionSync(window, codexSync)
      const stopLiveWatch = watchLiveSessions(window, sessions)
      window.once('closed', () => {
        claudeWatch?.unsubscribe()
        codexWatch?.unsubscribe()
        stopLiveWatch()
        desktopWindow = undefined
        detachTrpc()
        actor.send({ type: 'Shutdown' })
        stores.close()
      })
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

let applicationStores: ReturnType<typeof openDurableStores> | undefined

async function prepare() {
  if (DEVELOPMENT_INSTANCE) {
    const { projectData } = developmentStoreDirectories({
      userData: app.getPath('userData'),
      appData: app.getPath('appData'),
      instance: DEVELOPMENT_INSTANCE,
    })
    resetIncompleteDevelopmentDatabase(projectData)
    const projects = openProjectStore(projectData)
    await seedDevelopmentProject(projects, DEVELOPMENT_INSTANCE)
    projects.close()
  }
  const { projectData } = developmentStoreDirectories({
    userData: app.getPath('userData'),
    appData: app.getPath('appData'),
    instance: DEVELOPMENT_INSTANCE,
  })
  applicationStores = openDurableStores(projectData, !ACCEPTANCE_ENABLED)
  return { database: applicationStores.database, databasePath: applicationStores.databasePath }
}

async function ready(actor: AppActor): Promise<void> {
  // Main-process `net.fetch` reads `file://` directly, unlike a renderer's own subresource
  // requests, so this is immune to the restriction the scheme itself exists to route around.
  protocol.handle(ATTACHMENT_SCHEME, (request) => {
    const filePath = attachmentPathFromUrl(request.url)
    return filePath ? net.fetch(pathToFileURL(filePath).href) : new Response(null, { status: 400 })
  })
  if (applicationStores === undefined) throw new Error('Application stores are unavailable.')
  createWindow(actor, applicationStores)

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
