import { _electron as electron, type Page } from 'playwright-core'
import { ACCEPTANCE_ENV } from '../../../../scripts/acceptance-protocol.mjs'
import { writeFakeClaude } from '../../../agents/claude/session-fake-driver/session-resume-case'
import { writeFakeCodex } from '../../../agents/codex/session-fake-driver/fixture-driver'
import { appExecutable } from '../../desktop-proof/packaged-test-copy'
import { PROJECT_PROOF_STORE_ENV } from '../../projects/fake-driver/project-proof-protocol'
import {
  SESSION_CLAUDE_ARCHIVE_ENV,
  SESSION_CLAUDE_EXECUTABLE_ENV,
  SESSION_CLAUDE_TRANSCRIPTS_ENV,
  SESSION_CODEX_EXECUTABLE_ENV,
  SESSION_CODEX_TRANSCRIPTS_ENV,
  SESSION_FAKE_REPLY_DELAY_MS_ENV,
} from '../proof-protocol'
import { prepare } from './session-feed-fixture'

const SESSION_VIEWPORT = { width: 1440, height: 860 }

// A ring buffer of renderer console output, so a failure can print what the page said right
// before it broke instead of sending a reader back to a headless re-run (#2201).
const RECENT_CONSOLE_LINES = 50

type LaunchOptions = { replyDelayMs?: number }

function keepRecentConsole(page: Page, lines: string[]) {
  const keep = (line: string) => {
    lines.push(line)
    if (lines.length > RECENT_CONSOLE_LINES) lines.shift()
  }
  page.on('console', (message) => keep(`[${message.type()}] ${message.text()}`))
  page.on('pageerror', (error) => keep(`[pageerror] ${error.stack ?? error.message}`))
}

// Runs a launch or restart, pushing its wall time in milliseconds for the proof's timings line.
async function timed<T>(launches: number[], start: () => Promise<T>) {
  const started = performance.now()
  try {
    return await start()
  } finally {
    launches.push(Math.round(performance.now() - started))
  }
}

// Launches the packaged app against the fixture's fake CLIs, then restarts it in place so
// roster/resume proof cases can exercise a fresh process without losing the fixture root.
export async function createPackagedSessionHarness(root: string) {
  const fixture = await prepare(root)
  const fakeClaude = await writeFakeClaude(root, fixture.claudeTranscripts)
  const fakeCodex = await writeFakeCodex(root)
  let application: Awaited<ReturnType<typeof electron.launch>> | undefined
  let recentConsole: string[] = []
  const launches: number[] = []

  // The fake CLIs read their reply delay when the app spawns them, so it is fixed per launch.
  const open = async (options: LaunchOptions) => {
    application = await electron.launch({
      executablePath: appExecutable(fixture.application),
      env: {
        ...process.env,
        [SESSION_CLAUDE_TRANSCRIPTS_ENV]: fixture.claudeTranscripts,
        [SESSION_CODEX_TRANSCRIPTS_ENV]: fixture.codexTranscripts,
        [SESSION_CLAUDE_ARCHIVE_ENV]: fixture.archive,
        [SESSION_CLAUDE_EXECUTABLE_ENV]: fakeClaude,
        [SESSION_CODEX_EXECUTABLE_ENV]: fakeCodex,
        [SESSION_FAKE_REPLY_DELAY_MS_ENV]: String(options.replyDelayMs ?? 0),
        [PROJECT_PROOF_STORE_ENV]: fixture.userData,
        [ACCEPTANCE_ENV]: '0',
      },
      timeout: 30_000,
    })
    const page = await application.firstWindow()
    page.setDefaultTimeout(30_000)
    recentConsole = []
    keepRecentConsole(page, recentConsole)
    await application.evaluate(({ BrowserWindow }, viewport) => {
      BrowserWindow.getAllWindows()[0].setContentSize(viewport.width, viewport.height)
    }, SESSION_VIEWPORT)
    await page.waitForFunction(
      (viewport) => window.innerWidth === viewport.width && window.innerHeight === viewport.height,
      SESSION_VIEWPORT,
    )
    await page.waitForFunction(() => typeof window.argo?.listSessions === 'function')
    return page
  }

  const launch = (options: LaunchOptions = {}) => timed(launches, () => open(options))

  const restart = (options: LaunchOptions = {}) =>
    timed(launches, async () => {
      await application?.close()
      return open(options)
    })

  return {
    fixture,
    fakeClaude,
    fakeCodex,
    launch,
    restart,
    launches: () => launches,
    close: () => application?.close(),
    application: () => application,
    isPackaged: () => application?.evaluate(({ app }) => app.isPackaged),
    recentConsole: () => recentConsole,
  }
}
