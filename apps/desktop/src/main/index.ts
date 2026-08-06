import { join } from 'node:path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, shell } from 'electron'
import icon from '../../resources/icon.png?asset'
import { wireGit } from './git'
import { createHub, type Hub, wireProjection } from './hub'
import { createObserver, transcriptRoot } from './observe'
import { REGISTRY_FILENAME, readRegistry, toProjectEvents, wireProjects } from './projects'
import { createAgentLauncher, createAgentTerminals, wireSpawn, wireTerminal } from './terminals'
import { createTokenStore, createWorkItemSync, nodeHttp, wireWorkItems } from './workItems'

/** Where the encrypted provider token sits — per-machine `userData`, beside the registry and
 * as uncommitted as it is (ADR-0018). */
const TOKEN_FILENAME = 'work-item-token.bin'

// The Project registry is the one thing Argo owns rather than observes (ADR-0017). Replaying
// it before the launch sweep means observed Sessions attribute to their Project as they
// arrive, rather than appearing unattributed and then jumping.
async function restoreProjects(hub: Hub, registryFile: string): Promise<void> {
  const registry = await readRegistry(registryFile)
  for (const event of toProjectEvents(registry)) hub.apply(event)
}

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
  const registryFile = join(app.getPath('userData'), REGISTRY_FILENAME)
  wireProjection(hub)
  // Seam B observes real claude sessions: one launch sweep of the CLI transcript dirs discovers,
  // stitches and grades each Session into the roster, then a watch keeps them current by
  // re-reading only the file that moved (ADR-0008). The root is env-overridable so a packaged
  // run can be pointed at a deterministic fixture world.
  const observer = createObserver(hub, { root: transcriptRoot(process.env) })
  void restoreProjects(hub, registryFile).then(() => observer.start())
  app.on('will-quit', () => observer.stop())
  // Seam B: the steering PTY behind a session's Dock. The Dock steers the AGENT's own terminal
  // (#323), so the ptys ⌘N spawns are kept here and the bridge routes a renderer's attach to the
  // one owned by the session it named — via the ownership registry both sides share.
  const terminals = createAgentTerminals()
  const launcher = createAgentLauncher(observer.managed, terminals)
  wireTerminal({ hub, managed: observer.managed, terminals, launcher })
  // The app shell's own seams (#264): the global git group over the active project's primary
  // checkout, the project strip's register/activate, and ⌘N's spawn. Spawn claims the folder in
  // the observer's ownership registry, which is what makes a spawned Session `managed`.
  wireGit(hub)
  wireProjects(hub, registryFile)
  wireSpawn(hub, launcher)
  // The Work Item provider port (ADR-0018): a poll per active Project over the provider's HTTP
  // API, never `gh`. Sync follows the active Project off the projection; the bridge owns the
  // one act the renderer cannot perform, which is the device-flow sign-in.
  const tokenStore = createTokenStore(join(app.getPath('userData'), TOKEN_FILENAME))
  const workItems = createWorkItemSync({ hub, tokenStore, http: nodeHttp })
  wireWorkItems({
    sync: workItems,
    tokenStore,
    http: nodeHttp,
    clientId: process.env.ARGO_GITHUB_CLIENT_ID,
  })
  workItems.start()
  app.on('will-quit', () => workItems.stop())

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
