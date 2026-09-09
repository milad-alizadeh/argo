import path from 'node:path'
import { app, BrowserWindow } from 'electron'
import { reportAcceptance, runAcceptance } from './pty-acceptance'

// Forge's Vite plugin injects these for each configured renderer.
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined
declare const MAIN_WINDOW_VITE_NAME: string

// The PTY acceptance boundary (#1749, run against node-pty by #1791) lives in the SHIPPED main
// process behind this flag, because the only place its properties are true or false is inside the
// packaged, signed app: behind the hardened runtime, the asar and the code signature. A dev-server
// run proves none of it. `scripts/prove-packaged-pty.mjs` is what drives the packaged binary.
const ACCEPTANCE_ENABLED = process.env.ARGO_PTY_ACCEPTANCE === '1'

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    show: !ACCEPTANCE_ENABLED,
    webPreferences: {
      // Forge's Vite plugin emits main and preload side by side in .vite/build.
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    void window.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`))
  }

  return window
}

void app.whenReady().then(async () => {
  createWindow()

  if (!ACCEPTANCE_ENABLED) return

  // A window is open and a PTY may still be draining, so this run also stands as the app-shutdown
  // case: the driver outside fails the build if the process does not go away on its own.
  const result = await runAcceptance(app.getPath('home'))
  reportAcceptance(result)
  if (result.ok) app.quit()
  else app.exit(1)
})

app.on('window-all-closed', () => {
  app.quit()
})
