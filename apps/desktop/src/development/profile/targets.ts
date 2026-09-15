// The two apps a scenario can run against. The dev target is the window the reader already has
// open, reached over the debugging port `bun run dev` opens; the packaged target is a throwaway
// copy of the packaged app, seeded with a fixture, for readings that compare across runs.
import { execFile } from 'node:child_process'
import { mkdtemp, realpath, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { type CDPSession, chromium, type Page } from 'playwright-core'
import { show } from '../../core/projects/fake-driver/cockpit-driver'
import { createPackagedSessionHarness } from '../../core/sessions/fake-driver/packaged-session-harness'
import type { ProfileOptions, Scenario } from './scenario'

export type Target = { page: Page; cdp: CDPSession; close: () => Promise<void> }

const run = promisify(execFile)

// `dev:status` owns reading and checking the ready record, so this asks it rather than a copy.
async function devStatus() {
  try {
    const { stdout } = await run(process.execPath, ['scripts/dev-control.mjs', 'status'])
    return JSON.parse(stdout) as { debugPort: number; port: number }
  } catch (error) {
    const reason = error instanceof Error && 'stderr' in error ? String(error.stderr).trim() : ''
    throw new Error(
      `No dev instance answered for this worktree. Start it with \`bun run dev\`. ${reason}`,
    )
  }
}

export async function devTarget(scenario: Scenario, options: ProfileOptions): Promise<Target> {
  const status = await devStatus()
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${status.debugPort}`)
  const pages = browser.contexts().flatMap((context) => context.pages())
  const page = pages.find((candidate) => new URL(candidate.url()).port === String(status.port))
  if (!page) throw new Error(`The dev instance has no window on port ${status.port}.`)
  const visible = await page.evaluate(() => document.visibilityState === 'visible')
  if (!visible)
    throw new Error(
      'The dev window is minimised or fully covered. Put it on screen, then run again.',
    )
  if (options.session) await scenario.open(page, options.session)
  return {
    page,
    cdp: await page.context().newCDPSession(page),
    // Disconnects only: the reader's dev window stays open.
    close: () => browser.close(),
  }
}

export async function packagedTarget(scenario: Scenario, options: ProfileOptions): Promise<Target> {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'argo-profile-')))
  const harness = await createPackagedSessionHarness(root)
  const sessionId = await scenario.seedPackaged(harness.fixture.claudeTranscripts, options)
  const page = await harness.launch()
  const application = harness.application()
  if (!application) throw new Error('The packaged app did not launch.')
  // A hidden window paints nothing and Chromium throttles its frames, so the run needs it shown.
  await show(application)
  await scenario.open(page, sessionId)
  return {
    page,
    cdp: await page.context().newCDPSession(page),
    close: async () => {
      await harness.close()
      await rm(root, { recursive: true, force: true })
    },
  }
}
