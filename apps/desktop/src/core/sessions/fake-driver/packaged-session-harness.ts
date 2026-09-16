import { _electron as electron, type Page } from 'playwright-core'
import { ACCEPTANCE_ENV } from '../../../../scripts/acceptance-protocol.mjs'
import { appExecutable } from '../../desktop-proof/packaged-test-copy'
import { PROJECT_PROOF_STORE_ENV } from '../../projects/fake-driver/project-proof-protocol'
import {
  SESSION_CLAUDE_ARCHIVE_ENV,
  SESSION_CLAUDE_EXECUTABLE_ENV,
  SESSION_CLAUDE_TRANSCRIPTS_ENV,
  SESSION_CODEX_EXECUTABLE_ENV,
  SESSION_CODEX_TRANSCRIPTS_ENV,
} from '../proof-protocol'
import type { SessionCliBackend, SessionCliLaunch, SessionCliRun } from './session-cli-backend'
import { prepare } from './session-feed-fixture'

const SESSION_VIEWPORT = { width: 1440, height: 860 }

// A ring buffer of renderer console output, so a failure can print what the page said right
// before it broke instead of sending a reader back to a headless re-run (#2201).
const RECENT_CONSOLE_LINES = 50

function keepRecentConsole(page: Page, lines: string[]) {
  const keep = (line: string) => {
    lines.push(line)
    if (lines.length > RECENT_CONSOLE_LINES) lines.shift()
  }
  page.on('console', (message) => keep(`[${message.type()}] ${message.text()}`))
  page.on('pageerror', (error) => keep(`[pageerror] ${error.stack ?? error.message}`))
}

// Unset leaves the shipped app reading the machine's own transcript roots under HOME, which is
// what a backend running the real CLIs asks for.
function transcriptEnv(transcripts: SessionCliRun['transcripts']): Record<string, string> {
  if (transcripts === null) return {}
  return {
    [SESSION_CLAUDE_TRANSCRIPTS_ENV]: transcripts.claude,
    [SESSION_CODEX_TRANSCRIPTS_ENV]: transcripts.codex,
    [SESSION_CLAUDE_ARCHIVE_ENV]: transcripts.archive,
  }
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

// Launches the packaged app against the CLIs the backend names, then restarts it in place so
// roster/resume proof cases can exercise a fresh process without losing the fixture root.
export async function createPackagedSessionHarness(root: string, backend: SessionCliBackend) {
  const fixture = await prepare(root)
  const run = await backend.start({ root, fixture })
  let application: Awaited<ReturnType<typeof electron.launch>> | undefined
  let recentConsole: string[] = []
  const launches: number[] = []

  // The CLIs read their launch environment when the app spawns them, so it is fixed per launch.
  const open = async (launch: SessionCliLaunch) => {
    application = await electron.launch({
      executablePath: appExecutable(fixture.application),
      env: {
        ...process.env,
        ...transcriptEnv(run.transcripts),
        [SESSION_CLAUDE_EXECUTABLE_ENV]: run.executables.claude,
        [SESSION_CODEX_EXECUTABLE_ENV]: run.executables.codex,
        ...run.launchEnv(launch),
        [PROJECT_PROOF_STORE_ENV]: fixture.userData,
        [ACCEPTANCE_ENV]: '0',
      },
      timeout: backend.budgetMs,
    })
    const page = await application.firstWindow()
    page.setDefaultTimeout(backend.budgetMs)
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

  const launch = (options: Partial<SessionCliLaunch> = {}) =>
    timed(launches, () => open({ slowReply: options.slowReply ?? false }))

  const restart = (options: Partial<SessionCliLaunch> = {}) =>
    timed(launches, async () => {
      await application?.close()
      return open({ slowReply: options.slowReply ?? false })
    })

  return {
    fixture,
    launch,
    restart,
    launches: () => launches,
    close: () => application?.close(),
    isPackaged: () => application?.evaluate(({ app }) => app.isPackaged),
    recentConsole: () => recentConsole,
  }
}
