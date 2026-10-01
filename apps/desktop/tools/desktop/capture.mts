// Repeatable visual captures of the app under test, one PNG per screen.
//
//   bun run capture:desktop -- [output-dir]
//
// It runs the app against isolated application data, so a capture never reads or writes
// the real Project registry. The window is shown because Chromium throttles a hidden one and the
// capture comes back unpainted; nothing here holds the real keyboard or mouse.
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import type { ElectronApplication, Page } from 'playwright-core'
import { closeApplication } from '../../e2e/application-under-test'
import { launch, prepare } from '../../e2e/projects/fixtures/project.fixture'
import { type Screen, show, waitForScreen } from './desktop-driver'

const VIEWPORT = { width: 1200, height: 800 }

const outputDirectory = path.resolve(
  process.argv[2] ?? path.join(process.cwd(), 'out', 'desktop-captures'),
)

type Run = { application: ElectronApplication; page: Page }

// Fonts and running transitions finish first, so two runs of this script agree.
async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.allSettled(document.getAnimations().map((animation) => animation.finished))
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
}

// The renderer ignores the appearance the main process resolves (#3069), so each screen is captured
// once, in the appearance it draws, and the file names that appearance.
async function capture(run: Run, screen: Screen) {
  await settle(run.page)
  const appearance = await run.page.evaluate(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  )
  const encoded = await run.application.evaluate(async ({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0]
    if (window === undefined) throw new Error('The app opened no window.')
    return (await window.webContents.capturePage()).toPNG().toString('base64')
  })
  const name = `${screen}-${appearance}.png`
  await writeFile(path.join(outputDirectory, name), Buffer.from(encoded, 'base64'))
  return name
}

async function session(fixture: { application: string; userData: string }, screen: Screen) {
  const application = await launch(fixture)
  try {
    const page = await application.firstWindow()
    await waitForScreen(page, screen)
    await show(application)
    // One size for every PNG the run writes, set before the first capture rather than beside it:
    // a resize is a relayout, and a capture taken in the same breath as one catches the old width.
    await application.evaluate(({ BrowserWindow }, size) => {
      BrowserWindow.getAllWindows()[0]?.setContentSize(size.width, size.height)
    }, VIEWPORT)
    await page.waitForFunction(
      (size) => window.innerWidth === size.width && window.innerHeight === size.height,
      VIEWPORT,
    )
    return await capture({ application, page }, screen)
  } finally {
    await closeApplication(application)
  }
}

// Realpath: on macOS the temporary tree is reached through a symlink, and git resolves it, so
// an unresolved fixture path would never equal the path the registry stores.
const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'argo-app-capture-')))
try {
  await mkdir(outputDirectory, { recursive: true })
  const fixture = await prepare(root)
  // Application data with no Project registered draws the empty-project window.
  const emptyUserData = path.join(root, 'empty-userData')
  await mkdir(emptyUserData)
  const written = [
    await session({ application: fixture.application, userData: emptyUserData }, 'empty'),
    await session(fixture, 'project'),
  ]
  process.stdout.write(`${JSON.stringify({ ok: true, outputDirectory, captures: written })}\n`)
} finally {
  await rm(root, { recursive: true, force: true })
}
