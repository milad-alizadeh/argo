// Renders one PNG per state of a design page, which is how a design ticket carries its states.
// A design page is plain HTML over file://, so this needs a browser and nothing else: Electron is
// already a dependency here, so the design and the app are drawn by one Chromium.
//
//   bun run render:design -- <page.html> <output-dir> <state>...
//
// A state names the page's own URL fragment, optionally with `@<width>` for a narrower window and
// `:light` for the light appearance: `narrow@900:light`.
// Electron runs this file itself and captures through `webContents.capturePage()`, rather than a
// driver attaching from outside: `playwright-core`'s Electron launcher waits on a handshake that
// a one-window script never completes.
//
// Every `await` here is inside a callback. Electron hangs forever on a top-level `await` in an ESM
// main entry, because module evaluation finishes before the event loop that would settle it runs.
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { app, BrowserWindow } from 'electron'

const VIEWPORT = { width: 1200, height: 800 }

const [pagePath, outputDirectory, ...states] = process.argv.slice(2)

function openWindow() {
  // The window is shown: Chromium throttles a hidden one and the capture comes back as an
  // unpainted frame rather than as an error.
  return new BrowserWindow({
    ...VIEWPORT,
    show: true,
    useContentSize: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  })
}

async function capture(window, pageURL, state) {
  const [target, appearance = 'dark'] = state.split(':')
  const [fragment, width = String(VIEWPORT.width)] = target.split('@')
  if (!/^\d+$/.test(width))
    throw new Error(`${state}: the width after @ must be a number of pixels`)
  window.setContentSize(Number(width), VIEWPORT.height)
  await window.loadURL(`${pageURL}${appearance === 'light' ? '?light' : ''}#${fragment}`)
  // Web fonts change every measurement on the page, so a capture taken before they land renders a
  // different design.
  await window.webContents.executeJavaScript('document.fonts.ready.then(() => true)')
  // A fragment-only load is a same-document navigation: capturePage returns the last composited
  // frame, which is still the previous state until the next one paints.
  const nextPaint =
    'new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))'
  await window.webContents.executeJavaScript(nextPaint)
  // A width change can start a transition, a pane sliding shut, that the capture would catch half
  // done. A looping animation, a spinner, never finishes, so only the finite ones are waited on.
  await window.webContents.executeJavaScript(`Promise.all(document.getAnimations()
    .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
    .map((animation) => animation.finished)).then(() => ${nextPaint})`)
  const image = await window.webContents.capturePage()
  const size = width === String(VIEWPORT.width) ? '' : `-${width}`
  const name = `${fragment}${size}-${appearance}.png`
  await writeFile(path.join(outputDirectory, name), image.toPNG())
  return name
}

async function renderAll() {
  const pageURL = pathToFileURL(path.resolve(pagePath)).href
  await mkdir(outputDirectory, { recursive: true })
  const window = openWindow()
  for (const state of states) process.stdout.write(`${await capture(window, pageURL, state)}\n`)
}

if (!pagePath || !outputDirectory || states.length === 0) {
  process.stderr.write('usage: render-design-page.mjs <page.html> <output-dir> <state>...\n')
  process.exit(2)
}

app.whenReady().then(() =>
  renderAll().then(
    () => app.exit(0),
    (error) => {
      process.stderr.write(`${error.stack ?? error}\n`)
      app.exit(1)
    },
  ),
)
