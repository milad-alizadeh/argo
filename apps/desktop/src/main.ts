import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, BrowserWindow } from 'electron'
import { ACCEPTANCE_ENV } from '../scripts/acceptance-protocol.mjs'
import { PROJECT_PROOF_STORE_ENV } from '../scripts/project-proof-protocol.mjs'
import { attachProjectBridge } from './projects/bridge'

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
const projectProofStore = process.env[PROJECT_PROOF_STORE_ENV]
if (projectProofStore) app.setPath('userData', projectProofStore)

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    show: !ACCEPTANCE_ENABLED && !projectProofStore,
    webPreferences: {
      // Forge's Vite plugin emits main and preload side by side in .vite/build.
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  const rendererPath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
  const rendererURL = MAIN_WINDOW_VITE_DEV_SERVER_URL || pathToFileURL(rendererPath).href
  attachProjectBridge(window, { userData: app.getPath('userData'), rendererURL })

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    void window.loadFile(rendererPath)
  }

  return window
}

void app.whenReady().then(async () => {
  createWindow()

  if (!ACCEPTANCE_ENABLED) return

  // A window is open and a PTY may still be draining, so this run also stands as the app-shutdown
  // case: the driver outside fails the build if the process does not go away on its own.
  const { reportAcceptance, runAcceptance } = await import('./pty-acceptance')
  const result = await runAcceptance(app.getPath('home'))
  await reportAcceptance(result)
  if (result.ok) app.quit()
  else app.exit(1)
})

app.on('window-all-closed', () => {
  app.quit()
})
