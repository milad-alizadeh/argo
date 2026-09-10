// Repeatable visual captures of the PACKAGED cockpit, one PNG per state and appearance.
//
//   bun run capture:cockpit -- [output-dir]
//
// It runs the shipped app against isolated application data, so a capture never reads or writes
// the real Project registry, and it drives the states through the shipped controls rather than
// through a fixture, so a screenshot is of the app rather than of a mock. The window is shown
// because Chromium throttles a hidden one and the capture comes back unpainted; nothing here
// holds the real keyboard or mouse.
import { mkdir, mkdtemp, realpath, rename, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { desktopRoot } from '../../../scripts/packaged-app.mjs'
import { chooseThen, show, waitForCockpit, waitForDeck } from './cockpit-driver'
import { launch, prepare } from './project-proof-fixture'

const VIEWPORT = { width: 1200, height: 800 }
const APPEARANCES = ['light', 'dark']

const outputDirectory = path.resolve(
  process.argv[2] ?? path.join(desktopRoot, 'out', 'cockpit-captures'),
)

// The class lands one render before the pixels do: every token in the sheet is a colour under a
// transition, so a capture taken on the class alone catches the appearance halfway. Waiting for
// the running animations to finish is what makes two runs of this script agree.
async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.allSettled(document.getAnimations().map((animation) => animation.finished))
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
}

async function capture(run, state) {
  // The state is named, so it is also waited for. A deck still loading draws nothing, and a blank
  // PNG under the right filename is the one failure a capture run cannot report on its own.
  await waitForDeck(run.page, state)
  const written = []
  for (const appearance of APPEARANCES) {
    await run.page.evaluate((chosen) => window.argo.setAppearance(chosen), appearance)
    await run.page.waitForFunction(
      (dark) => document.documentElement.classList.contains('dark') === dark,
      appearance === 'dark',
    )
    await settle(run.page)
    const encoded = await run.application.evaluate(async ({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0]
      return (await window.webContents.capturePage()).toPNG().toString('base64')
    })
    const name = `${state}-${appearance}.png`
    await writeFile(path.join(outputDirectory, name), Buffer.from(encoded, 'base64'))
    written.push(name)
  }
  return written
}

async function session(fixture, body) {
  const application = await launch(fixture)
  try {
    const page = await application.firstWindow()
    await waitForCockpit(page)
    const run = { application, page, fixture }
    await show(application)
    // One size for every PNG the run writes, set before the first capture rather than beside it:
    // a resize is a relayout, and a capture taken in the same breath as one catches the old width.
    await application.evaluate(({ BrowserWindow }, size) => {
      BrowserWindow.getAllWindows()[0].setContentSize(size.width, size.height)
    }, VIEWPORT)
    await page.waitForFunction(
      (size) => window.innerWidth === size.width && window.innerHeight === size.height,
      VIEWPORT,
    )
    return await body(run)
  } finally {
    await application.close()
  }
}

// Realpath: on macOS the temporary tree is reached through a symlink, and git resolves it, so
// an unresolved fixture path would never equal the path the registry stores.
const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'argo-cockpit-capture-')))
try {
  await mkdir(outputDirectory, { recursive: true })
  const fixture = await prepare(root)
  const written = []
  written.push(
    ...(await session(fixture, async (run) => {
      const names = await capture(run, 'empty')
      await chooseThen(run, fixture.beta, { button: 'Open Project…', state: 'selected' })
      names.push(...(await capture(run, 'selected')))
      await chooseThen(run, fixture.plain, {
        button: 'Open another Project…',
        state: 'not-a-repository',
      })
      names.push(...(await capture(run, 'not-a-repository')))
      return names
    })),
  )
  // The refusal is a fact about storage, not a screen a control can reach: the Project has to be
  // registered and its folder gone before the next launch draws it.
  await rename(fixture.beta, fixture.moved)
  written.push(...(await session(fixture, (run) => capture(run, 'refused'))))
  process.stdout.write(`${JSON.stringify({ ok: true, outputDirectory, captures: written })}\n`)
} finally {
  await rm(root, { recursive: true, force: true })
}
