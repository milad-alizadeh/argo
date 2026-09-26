import { type ElectronApplication, _electron as electron, type Page } from 'playwright-core'
import {
  SESSION_CLAUDE_EXECUTABLE_ENV,
  SESSION_CLAUDE_SYNC_FIXTURE_ENV,
  SESSION_CLAUDE_TRANSCRIPTS_ENV,
  SESSION_CODEX_EXECUTABLE_ENV,
  SESSION_CODEX_TRANSCRIPTS_ENV,
} from '@/harnesses/proof-protocol'
import { PROJECT_PROOF_STORE_ENV } from '@/platform/contract/project-proof'
import { ACCEPTANCE_ENV } from '../../scripts/acceptance-protocol.mts'
import { appExecutable } from '../packaged-app'
import type {
  SessionFixture,
  SessionHarnessBackend,
  SessionHarnessLaunch,
  SessionHarnessRun,
} from './session-harness-backend'

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
function transcriptEnv(transcripts: SessionHarnessRun['transcripts']): Record<string, string> {
  if (transcripts === null) return {}
  return {
    [SESSION_CLAUDE_TRANSCRIPTS_ENV]: transcripts.claude,
    [SESSION_CODEX_TRANSCRIPTS_ENV]: transcripts.codex,
  }
}

function launchEnvironment(run: SessionHarnessRun, launch: SessionHarnessLaunch, project: string) {
  const syncFixture =
    launch.sessionSyncFixture === undefined
      ? undefined
      : {
          ...launch.sessionSyncFixture,
          records: launch.sessionSyncFixture.records.map((record) => {
            if (
              typeof record !== 'object' ||
              record === null ||
              !('cwd' in record) ||
              record.cwd !== '$PROJECT'
            )
              return record
            return { ...record, cwd: project }
          }),
        }
  const environment = {
    ...process.env,
    ...transcriptEnv(run.transcripts),
    [SESSION_CLAUDE_EXECUTABLE_ENV]: run.executables.claude,
    [SESSION_CODEX_EXECUTABLE_ENV]: run.executables.codex,
    ...(syncFixture === undefined
      ? {}
      : { [SESSION_CLAUDE_SYNC_FIXTURE_ENV]: JSON.stringify(syncFixture) }),
    ...run.launchEnv(launch),
  }
  for (const name of run.unsetEnv ?? []) delete environment[name]
  return environment
}

export type PackagedSession = Awaited<ReturnType<typeof createPackagedSessionHarness>>

// Launches the packaged app against the CLIs the backend names, and restarts it in place so a case
// can read what a fresh process makes of the same fixture root.
export async function createPackagedSessionHarness(request: {
  root: string
  fixture: SessionFixture
  backend: SessionHarnessBackend
  launch: SessionHarnessLaunch
  // Runs once per process the harness opens, before the window is sized.
  launched: (application: ElectronApplication, page: Page) => Promise<void>
  // Runs before a restart closes the process.
  closing: () => Promise<void>
  // Set to record a .webm of the window for this run (electron.launch's own recordVideo option).
  videoDir?: string
}) {
  const { root, fixture, backend, launch, launched, closing, videoDir } = request
  const run = await backend.start({ root, fixture })
  let application: ElectronApplication | undefined
  let page: Page | undefined
  let recentConsole: string[] = []

  // The CLIs read their launch environment when the app spawns them, so it is fixed per launch.
  const open = async () => {
    application = await electron.launch({
      executablePath: appExecutable(fixture.application),
      env: {
        ...launchEnvironment(run, launch, fixture.project),
        [PROJECT_PROOF_STORE_ENV]: fixture.userData,
        [ACCEPTANCE_ENV]: '0',
      },
      timeout: backend.budgetMs,
      ...(videoDir ? { recordVideo: { dir: videoDir, size: SESSION_VIEWPORT } } : {}),
    })
    const opened = await application.firstWindow()
    opened.setDefaultTimeout(backend.budgetMs)
    recentConsole = []
    keepRecentConsole(opened, recentConsole)
    await launched(application, opened)
    await application.evaluate(({ BrowserWindow }, viewport) => {
      BrowserWindow.getAllWindows()[0].setContentSize(viewport.width, viewport.height)
    }, SESSION_VIEWPORT)
    await opened.waitForFunction(
      (viewport) => window.innerWidth === viewport.width && window.innerHeight === viewport.height,
      SESSION_VIEWPORT,
    )
    await opened.waitForFunction(() => typeof window.argo?.listSessions === 'function')
    page = opened
    return opened
  }

  return {
    root,
    fixture,
    launch: open,
    restart: async (beforeOpen?: () => Promise<void>) => {
      await closing()
      await application?.close()
      await beforeOpen?.()
      return open()
    },
    // The window the case is driving now, which a restart replaces.
    page: () => {
      if (page === undefined) throw new Error('The packaged app did not launch.')
      return page
    },
    close: () => application?.close(),
    isPackaged: () => application?.evaluate(({ app }) => app.isPackaged),
    recentConsole: () => recentConsole,
  }
}
