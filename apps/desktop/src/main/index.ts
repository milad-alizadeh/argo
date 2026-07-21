import { join } from 'node:path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, shell } from 'electron'
import icon from '../../resources/icon.png?asset'
import { seedDemoSession } from './demoSeed'
import { createHub } from './hub'
import { startObservation } from './observe'
import { wireProjection } from './projectionBridge'
import { wireTerminal } from './terminalBridge'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    // Mirrors the dark --background token (main can't read renderer CSS) so there's no
    // white flash before the renderer paints.
    backgroundColor: '#0b0b0e',
    titleBarStyle: 'hiddenInset',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      // electron-vite emits the preload as ESM (.mjs) because the app is "type": "module";
      // loading the wrong extension silently skips the preload (no window.cockpit bridge).
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('dev.argo.cockpit')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Seam A: the authoritative hub and its IPC projection into the renderer (ADR-0005).
  const hub = createHub()
  wireProjection(hub)
  // Seam B now observes real external claude sessions on launch: a single sweep of the CLI
  // transcript dirs discovers, stitches and grades each Session into the roster (ADR-0008).
  void startObservation(hub)
  // Seam B: the steering PTY behind the Console's live channel — a renderer attaches and main
  // spawns its shell.
  wireTerminal()
  // Opt-in synthetic Session that drives the projection pipeline end-to-end (the
  // launch smoke sets this; run `ARGO_SEED_DEMO=1 bun run dev` to see it locally).
  // Nothing real is observed yet — drop when the session adapter lands.
  if (process.env.ARGO_SEED_DEMO === '1') seedDemoSession(hub)

  createWindow()

  app.on('activate', () => {
    // On macOS it's common to re-create a window when the dock icon is clicked
    // and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
