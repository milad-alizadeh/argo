import { mkdir, rm, writeFile } from 'node:fs/promises'
import { createConnection } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, BrowserWindow, nativeTheme, net, protocol } from 'electron'
import { ACCEPTANCE_ENV } from '../scripts/acceptance-protocol.mjs'
import { attachBridges } from './bridges'
import { windowBackground } from './core/appearance/appearance'
import { applyStoredAppearance, readAppearance } from './core/appearance/bridge'
import { installMenu } from './core/commands/menu'
import { setPlatformLanguage } from './core/i18n/platform'
import { PROJECT_PROOF_STORE_ENV } from './core/projects/proof-protocol'
import { ATTACHMENT_SCHEME, attachmentPathFromUrl } from './core/sessions/feed-images'
import { WINDOW_MINIMUM_WIDTH } from './core/window/minimum-width'
import { accountStoreDirectory } from './development/account-store'
import {
  developmentIdentityArgument,
  developmentInstance,
  developmentReadyRecord,
} from './development/instance'

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
// run proves none of it. `scripts/prove-packaged-pty.mjs` is what drives the packaged binary.
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
if (DEVELOPMENT_INSTANCE) {
  app.setName(DEVELOPMENT_INSTANCE.label)
  const ticket = DEVELOPMENT_INSTANCE.label.match(/^#(\d+)$/)?.[1]
  app.dock?.setBadge(ticket ?? '')
  app.setPath('userData', DEVELOPMENT_INSTANCE.userData)
  app.setPath('sessionData', path.join(DEVELOPMENT_INSTANCE.directory, 'session-data'))
  // Loopback only; agent-browser attaches here to profile, and a packaged app never opens it (#2228).
  app.commandLine.appendSwitch('remote-debugging-port', String(DEVELOPMENT_INSTANCE.debugPort))
}

async function writeDevelopmentReady(window: BrowserWindow): Promise<void> {
  if (!DEVELOPMENT_INSTANCE) return

  await mkdir(DEVELOPMENT_INSTANCE.directory, { recursive: true })
  await new Promise<void>((resolve, reject) => {
    const socket = createConnection(DEVELOPMENT_INSTANCE.controlFile)
    socket.once('error', reject)
    socket.once('connect', () =>
      socket.write(`ready ${process.pid} ${DEVELOPMENT_INSTANCE?.controlToken}`),
    )
    socket.once('data', (reply) => {
      if (reply.toString() === 'ready') resolve()
      else reject(new Error('Development launcher rejected Electron readiness.'))
      socket.end()
    })
  })
  await writeFile(
    DEVELOPMENT_INSTANCE.readyFile,
    `${JSON.stringify(developmentReadyRecord(DEVELOPMENT_INSTANCE, window.id), null, 2)}\n`,
    { mode: 0o600 },
  )
}

function createWindow(): BrowserWindow {
  const userData = app.getPath('userData')
  const accountData = accountStoreDirectory({
    userData,
    appData: app.getPath('appData'),
    instance: DEVELOPMENT_INSTANCE,
  })
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: WINDOW_MINIMUM_WIDTH,
    ...(DEVELOPMENT_INSTANCE ? { title: DEVELOPMENT_INSTANCE.title } : {}),
    show: !ACCEPTANCE_ENABLED && !PROOF_ENABLED,
    // ADR-0038: the chrome bar is a full width band and the traffic lights are inset into it, so
    // the frame keeps the native controls and gives up the native title bar.
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    // The window paints before the renderer does. Without this it paints white, which is a flash
    // of the wrong appearance on every launch into the dark one.
    backgroundColor: windowBackground(nativeTheme.shouldUseDarkColors),
    webPreferences: {
      ...(DEVELOPMENT_INSTANCE
        ? {
            additionalArguments: [
              developmentIdentityArgument({
                id: DEVELOPMENT_INSTANCE.id,
                label: DEVELOPMENT_INSTANCE.label,
                title: DEVELOPMENT_INSTANCE.title,
                worktree: DEVELOPMENT_INSTANCE.worktree,
              }),
            ],
          }
        : {}),
      // Forge's Vite plugin emits main and preload side by side in .vite/build.
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (DEVELOPMENT_INSTANCE) {
    window.webContents.on('page-title-updated', (event) => event.preventDefault())
  }

  const rendererPath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
  const rendererURL = MAIN_WINDOW_VITE_DEV_SERVER_URL || pathToFileURL(rendererPath).href
  attachBridges(window, {
    userData,
    accountData,
    rendererURL,
    proofEnabled: PROOF_ENABLED,
    acceptance: ACCEPTANCE_ENABLED,
  })
  installMenu(window)

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    void window.loadFile(rendererPath)
  }

  window.webContents.once('did-finish-load', () => {
    void writeDevelopmentReady(window).catch((error: unknown) => console.error(error))
  })

  return window
}

void app.whenReady().then(async () => {
  // The menu and the native dialogs are the only words the main process draws, and it reads the
  // language from the operating system. `app.getLocale()` answers only once Electron is ready.
  setPlatformLanguage(app.getLocale())
  // The stored choice is applied before the first window exists, so the frame is never drawn in
  // one appearance and corrected into the other.
  applyStoredAppearance(await readAppearance(app.getPath('userData')))
  // Main-process `net.fetch` reads `file://` directly, unlike a renderer's own subresource
  // requests, so this is immune to the restriction the scheme itself exists to route around.
  protocol.handle(ATTACHMENT_SCHEME, (request) => {
    const filePath = attachmentPathFromUrl(request.url)
    return filePath ? net.fetch(pathToFileURL(filePath).href) : new Response(null, { status: 400 })
  })
  createWindow()

  if (!ACCEPTANCE_ENABLED) return

  // A window is open and a PTY may still be draining, so this run also stands as the app-shutdown
  // case: the driver outside fails the build if the process does not go away on its own.
  const { reportAcceptance, runAcceptance } = await import('./pty-acceptance')
  const result = await runAcceptance(os.homedir())
  await reportAcceptance(result)
  if (result.ok) app.quit()
  else app.exit(1)
})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('will-quit', () => {
  if (DEVELOPMENT_INSTANCE) void rm(DEVELOPMENT_INSTANCE.readyFile, { force: true })
})
