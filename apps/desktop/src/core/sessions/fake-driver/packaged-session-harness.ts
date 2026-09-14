import { _electron as electron } from 'playwright-core'
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
} from '../proof-protocol'
import { prepare } from './session-feed-fixture'

const SESSION_VIEWPORT = { width: 1440, height: 860 }

// Launches the packaged app against the fixture's fake CLIs, then restarts it in place so
// roster/resume proof cases can exercise a fresh process without losing the fixture root.
export async function createPackagedSessionHarness(root: string) {
  const fixture = await prepare(root)
  const fakeClaude = await writeFakeClaude(root, fixture.claudeTranscripts)
  const fakeCodex = await writeFakeCodex(root)
  let application: Awaited<ReturnType<typeof electron.launch>> | undefined

  const launch = async () => {
    application = await electron.launch({
      executablePath: appExecutable(fixture.application),
      env: {
        ...process.env,
        [SESSION_CLAUDE_TRANSCRIPTS_ENV]: fixture.claudeTranscripts,
        [SESSION_CODEX_TRANSCRIPTS_ENV]: fixture.codexTranscripts,
        [SESSION_CLAUDE_ARCHIVE_ENV]: fixture.archive,
        [SESSION_CLAUDE_EXECUTABLE_ENV]: fakeClaude,
        [SESSION_CODEX_EXECUTABLE_ENV]: fakeCodex,
        [PROJECT_PROOF_STORE_ENV]: fixture.userData,
        [ACCEPTANCE_ENV]: '0',
      },
      timeout: 30_000,
    })
    const page = await application.firstWindow()
    page.setDefaultTimeout(30_000)
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

  const restart = async () => {
    await application?.close()
    return launch()
  }

  return {
    fixture,
    fakeClaude,
    fakeCodex,
    launch,
    restart,
    close: () => application?.close(),
    isPackaged: () => application?.evaluate(({ app }) => app.isPackaged),
  }
}
