import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, BrowserWindow, nativeTheme } from 'electron'
import { ACCEPTANCE_ENV } from '../scripts/acceptance-protocol.mjs'
import { createSystemClaudeSessionDriver } from './agents/claude/drive/system-claude-session-driver'
import { createClaudeSessionReader } from './agents/claude/sessions/read-sessions'
import { createCodexSessionReader } from './agents/codex/sessions/read-sessions'
import { windowBackground } from './core/appearance/appearance'
import {
  applyStoredAppearance,
  attachAppearanceBridge,
  readAppearance,
} from './core/appearance/bridge'
import { installMenu } from './core/commands/menu'
import { attachProjectBridge } from './core/projects/bridge'
import { PROJECT_PROOF_STORE_ENV } from './core/projects/fake-driver/project-proof-protocol'
import { attachWindowNavigation } from './core/security/window-navigation'
import { attachSessionBridge } from './core/sessions/bridge'
import { combineSessionReaders } from './core/sessions/combine-readers'
import {
  SESSION_CLAUDE_ARCHIVE_ENV,
  SESSION_CLAUDE_TRANSCRIPTS_ENV,
  SESSION_CODEX_TRANSCRIPTS_ENV,
} from './core/sessions/proof-protocol'

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

function claudeTranscriptsRoot(): string {
  return (
    process.env[SESSION_CLAUDE_TRANSCRIPTS_ENV] ??
    path.join(app.getPath('home'), '.claude', 'projects')
  )
}

function codexTranscriptsRoot(): string {
  return (
    process.env[SESSION_CODEX_TRANSCRIPTS_ENV] ??
    path.join(app.getPath('home'), '.codex', 'sessions')
  )
}

// The Claude desktop app's own store, read for its archive flag alone (`sessions/archive.ts`). It
// sits under the app's support folder, and a machine without that app has no folder there: the
// reading degrades to no archived Sessions rather than to a failure.
function claudeArchiveRoot(): string {
  return (
    process.env[SESSION_CLAUDE_ARCHIVE_ENV] ??
    path.join(
      app.getPath('home'),
      'Library',
      'Application Support',
      'Claude',
      'claude-code-sessions',
    )
  )
}

function createWindow(): BrowserWindow {
  const userData = app.getPath('userData')
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    show: !ACCEPTANCE_ENABLED && !PROOF_ENABLED,
    // ADR-0038: the chrome bar is a full width band and the traffic lights are inset into it, so
    // the frame keeps the native controls and gives up the native title bar.
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    // The window paints before the renderer does. Without this it paints white, which is a flash
    // of the wrong appearance on every launch into the dark one.
    backgroundColor: windowBackground(nativeTheme.shouldUseDarkColors),
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
  attachWindowNavigation(window)
  const claudeSessionDriver = createSystemClaudeSessionDriver(
    path.join(userData, 'claude-permission-plugins'),
  )
  attachProjectBridge(window, { userData, rendererURL })
  attachSessionBridge(window, {
    reader: combineSessionReaders([
      createClaudeSessionReader({
        transcripts: claudeTranscriptsRoot(),
        archive: claudeArchiveRoot(),
        managedSessions: claudeSessionDriver.roster,
      }),
      createCodexSessionReader(codexTranscriptsRoot()),
    ]),
    driver: claudeSessionDriver,
    starter: claudeSessionDriver,
    rendererURL,
  })
  attachAppearanceBridge(window, { userData, rendererURL })
  installMenu(window)
  app.once('before-quit', () => claudeSessionDriver.close())

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    void window.loadFile(rendererPath)
  }

  return window
}

void app.whenReady().then(async () => {
  // The stored choice is applied before the first window exists, so the frame is never drawn in
  // one appearance and corrected into the other.
  applyStoredAppearance(await readAppearance(app.getPath('userData')))
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
