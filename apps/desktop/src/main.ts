import { mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, type BrowserWindow, net, protocol } from 'electron'
import { seedDevelopmentProject } from '@/domains/projects/main/development-seed'
import { openProjectStore } from '@/domains/projects/main/main-store'
import { PROJECT_PROOF_STORE_ENV } from '@/domains/projects/main/proof-protocol'
import {
  ATTACHMENT_SCHEME,
  attachmentPathFromUrl,
} from '@/domains/sessions/contract/model/feed/feed-images'
import { openDurableStores } from '@/main/durable-stores'
import { attachAppearanceWatch } from '@/platform/main/appearance'
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
import { configureStorageRuntime } from '@/platform/main/storage/storage-runtime'
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

function createWindow(): void {
  const userData = app.getPath('userData')
  const { projectData } = developmentStoreDirectories({
    userData,
    appData: app.getPath('appData'),
    instance: DEVELOPMENT_INSTANCE,
  })
  const { close } = openDurableStores(projectData, !ACCEPTANCE_ENABLED)
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
    attach: (window) => {
      attachAppearanceWatch(window)
      window.once('closed', () => {
        desktopWindow = undefined
        close()
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
    resetIncompleteDevelopmentDatabase(projectData)
    const projects = openProjectStore(projectData)
    await seedDevelopmentProject(projects, DEVELOPMENT_INSTANCE)
    projects.close()
  }
  createWindow()

  if (!ACCEPTANCE_ENABLED) return

  // A window is open and a PTY may still be draining, so this run also stands as the app-shutdown
  // case: the driver outside fails the build if the process does not go away on its own.
  const { reportAcceptance, runAcceptance } = await import(
    '@/platform/main/pty-acceptance/pty-acceptance'
  )
  const result = await runAcceptance(os.homedir())
  await reportAcceptance(result)
  if (result.ok) app.quit()
  else app.exit(1)
}

startDesktopApplication({
  ready,
  focusExistingWindow: focusWindow,
  willQuit: () => {
    if (DEVELOPMENT_INSTANCE) void rm(DEVELOPMENT_INSTANCE.readyFile, { force: true })
    if (acceptanceUserData) void rm(acceptanceUserData, { recursive: true, force: true })
  },
})
