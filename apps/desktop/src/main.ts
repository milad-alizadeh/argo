import path from 'node:path'
import { app, BrowserWindow } from 'electron'
import * as pty from 'node-pty'

// Forge's Vite plugin injects these for each configured renderer.
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined
declare const MAIN_WINDOW_VITE_NAME: string

// The acceptance test for the toolchain decision (#1732, proved by #1743): the PACKAGED app
// must load node-pty, open a PTY, and exit cleanly on macOS arm64 and x64. A working dev
// server is not that proof, so the check lives in the shipped main process behind an env flag
// and scripts/prove-packaged-pty.mjs drives the packaged binary.
const SMOKE_ENABLED = process.env.ARGO_PTY_SMOKE === '1'
const SMOKE_TOKEN = process.env.ARGO_PTY_TOKEN ?? 'argo-pty-ok'
const SMOKE_TIMEOUT_MS = 20_000
const SMOKE_PREFIX = 'ARGO_PTY_SMOKE_RESULT '

function report(result: Record<string, unknown>): void {
  process.stdout.write(`${SMOKE_PREFIX}${JSON.stringify(result)}\n`)
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    show: !SMOKE_ENABLED,
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

// Opens one PTY, waits for the token to come back through it, and resolves with the evidence.
// Resolving means node-pty's native binding loaded from the packaged app AND the pseudo-terminal
// actually ran a shell.
function provePty(): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let output = ''
    let settled = false

    const child = pty.spawn('/bin/sh', ['-c', `uname -m; printf '%s\\n' ${SMOKE_TOKEN}`], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: app.getPath('home'),
      env: { ...process.env } as Record<string, string>,
    })

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill()
      reject(
        new Error(`PTY produced no token in ${SMOKE_TIMEOUT_MS}ms. Saw: ${JSON.stringify(output)}`),
      )
    }, SMOKE_TIMEOUT_MS)

    child.onData((chunk) => {
      output += chunk
      if (settled || !output.includes(SMOKE_TOKEN)) return
      settled = true
      clearTimeout(timer)
      child.kill()
      resolve({
        ok: true,
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        node: process.versions.node,
        processArch: process.arch,
        ptyUname: output.split('\n')[0]?.trim(),
        ptyPid: child.pid,
        packaged: app.isPackaged,
        resourcesPath: process.resourcesPath,
      })
    })
  })
}

void app.whenReady().then(async () => {
  createWindow()

  if (!SMOKE_ENABLED) return

  try {
    report(await provePty())
    app.quit()
  } catch (error) {
    report({ ok: false, error: error instanceof Error ? error.message : String(error) })
    app.exit(1)
  }
})

app.on('window-all-closed', () => {
  app.quit()
})
