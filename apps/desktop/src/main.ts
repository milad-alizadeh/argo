import { rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { pathToFileURL } from 'node:url'
import { app, net, protocol } from 'electron'
import { attachBridges } from '@/bridges'
import { seedDevelopmentProject } from '@/domains/projects/main/development-seed'
import { openProjectStore } from '@/domains/projects/main/main-store'
import { PROJECT_PROOF_STORE_ENV } from '@/domains/projects/main/proof-protocol'
import {
  ATTACHMENT_SCHEME,
  attachmentPathFromUrl,
} from '@/domains/sessions/contract/model/feed-images'
import { createSQLiteSessionTicketLinkStore } from '@/domains/tickets/main/session-links'
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
import { installMenu } from '@/platform/main/menu'
import { recoverDurableStore } from '@/platform/main/storage/durable-store-recovery'
import {
  backupSharedDatabase,
  sharedDatabaseBackupPath,
  sharedDatabasePath,
} from '@/platform/main/storage/shared-database'
import { createDesktopWindow } from '@/platform/main/window/create-window'
import { ACCEPTANCE_ENV } from '../scripts/acceptance-protocol.mts'

// Registering a privileged scheme is only valid before the app is ready (Electron's own
// constraint), so this runs at module load, ahead of every other side effect below.
protocol.registerSchemesAsPrivileged([
  {
    scheme: ATTACHMENT_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
])

// Forge's Vite plugin injects these for each configured renderer.
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

// The Project proof (#1825, extended by #1828) drives the SHIPPED app against its own application
// data, for the same reason the acceptance harness above lives here: a registry write is only
// proved inside the packaged, signed app, and a proof that wrote the real registry would be a
// proof nobody could run twice. It ships as one `app.setPath` and one `show`, and it is read from
// an absolute path so that a stray or empty value cannot silently move a person's Projects.
const projectProofStore = process.env[PROJECT_PROOF_STORE_ENV]
const PROOF_ENABLED = Boolean(projectProofStore && path.isAbsolute(projectProofStore))
if (PROOF_ENABLED && projectProofStore) app.setPath('userData', projectProofStore)

// The launch wrapper supplies these only for Forge's Vite development server. A packaged app
// never reads them, so production keeps its normal application state and window identity.
const DEVELOPMENT_INSTANCE = MAIN_WINDOW_VITE_DEV_SERVER_URL
  ? developmentInstance(process.env)
  : null

function openDurableStores(projectData: string) {
  const databasePath = sharedDatabasePath(projectData)
  const backupPath = sharedDatabaseBackupPath(projectData)
  return recoverDurableStore({
    databasePath,
    backupPath,
    open: () => {
      const projects = openProjectStore(projectData)
      const ticketLinkDatabase = new DatabaseSync(databasePath)
      const ticketLinks = createSQLiteSessionTicketLinkStore(ticketLinkDatabase, () =>
        backupSharedDatabase(ticketLinkDatabase, backupPath),
      )
      return { projects, ticketLinks }
    },
  })
}
let SETUP_DOCUMENT_SOURCE: 'proof' | 'development' | 'production' = 'production'
if (DEVELOPMENT_INSTANCE) SETUP_DOCUMENT_SOURCE = 'development'
if (PROOF_ENABLED) SETUP_DOCUMENT_SOURCE = 'proof'
if (DEVELOPMENT_INSTANCE) {
  // safeStorage keys belong to an app, so every development worktree must keep one app identity.
  app.setName(DEVELOPMENT_APPLICATION_NAME)
  const ticket = DEVELOPMENT_INSTANCE.label.match(/^#(\d+)$/)?.[1]
  app.dock?.setBadge(ticket ?? '')
  app.setPath('userData', DEVELOPMENT_INSTANCE.userData)
  app.setPath('sessionData', path.join(DEVELOPMENT_INSTANCE.directory, 'session-data'))
  app.commandLine.appendSwitch('remote-debugging-port', String(DEVELOPMENT_INSTANCE.debugPort))
}

function createWindow(): void {
  const userData = app.getPath('userData')
  const { accountData, connectionData, projectData } = developmentStoreDirectories({
    userData,
    appData: app.getPath('appData'),
    instance: DEVELOPMENT_INSTANCE,
  })
  const { projects, ticketLinks } = openDurableStores(projectData)
  createDesktopWindow({
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
      attachBridges(window, {
        userData,
        accountData,
        connectionData,
        projects,
        ticketLinks,
        rendererURL,
        proofEnabled: PROOF_ENABLED,
        setupDocumentSource: SETUP_DOCUMENT_SOURCE,
        acceptance: ACCEPTANCE_ENABLED,
      })
      window.once('closed', () => projects.close())
      installMenu(window)
    },
    loaded: (window) => {
      void writeDevelopmentReady(DEVELOPMENT_INSTANCE, window)
    },
  })
}

async function ready(): Promise<void> {
  // Main-process `net.fetch` reads `file://` directly, unlike a renderer's own subresource
  // requests, so this is immune to the restriction the scheme itself exists to route around.
  protocol.handle(ATTACHMENT_SCHEME, (request) => {
    const filePath = attachmentPathFromUrl(request.url)
    return filePath ? net.fetch(pathToFileURL(filePath).href) : new Response(null, { status: 400 })
  })
  if (DEVELOPMENT_INSTANCE) {
    const { projectData } = developmentStoreDirectories({
      userData: app.getPath('userData'),
      appData: app.getPath('appData'),
      instance: DEVELOPMENT_INSTANCE,
    })
    const projects = openProjectStore(projectData)
    await seedDevelopmentProject(projects, DEVELOPMENT_INSTANCE)
    projects.close()
  }
  createWindow()

  if (!ACCEPTANCE_ENABLED) return

  // A window is open and a PTY may still be draining, so this run also stands as the app-shutdown
  // case: the driver outside fails the build if the process does not go away on its own.
  const { reportAcceptance, runAcceptance } = await import('@/platform/main/testing/pty-acceptance')
  const result = await runAcceptance(os.homedir())
  await reportAcceptance(result)
  if (result.ok) app.quit()
  else app.exit(1)
}

startDesktopApplication({
  ready,
  willQuit: () => {
    if (DEVELOPMENT_INSTANCE) void rm(DEVELOPMENT_INSTANCE.readyFile, { force: true })
  },
})
