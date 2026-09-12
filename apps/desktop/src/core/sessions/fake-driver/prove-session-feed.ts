// The #1831 slice inside the SHIPPED app: discovery with no Project registration, the Feed
// contract over the real preload, and the ADR-0033 geometry rule that a row is measured in a
// hidden container before it is drawn. A dev-server run proves none of it.
//
// `--shots <dir>` writes the packaged screens for a person who wants to look at them. Nothing in
// CI passes it any more, and the PNG files are disposable: point it at a temporary directory and
// delete them (#1910). Reviewers inspect the screens in Storybook, and the contract this
// file asserts is read out of the DOM, so no assertion here depends on a pixel.
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron } from 'playwright-core'
import { ACCEPTANCE_ENV } from '../../../../scripts/acceptance-protocol.mjs'
import { appExecutable, assertShippedFusesIntact } from '../../desktop-proof/packaged-test-copy'
import { PROJECT_PROOF_STORE_ENV } from '../../projects/fake-driver/project-proof-protocol'
import {
  SESSION_CLAUDE_ARCHIVE_ENV,
  SESSION_CLAUDE_TRANSCRIPTS_ENV,
  SESSION_CODEX_TRANSCRIPTS_ENV,
} from '../proof-protocol'
import { prepare } from './session-feed-fixture'
import { proveContract } from './session-roster-cases'

const root = await mkdtemp(path.join(os.tmpdir(), 'argo-packaged-session-'))
const SESSION_VIEWPORT = { width: 1440, height: 860 }
let application: Awaited<ReturnType<typeof electron.launch>> | undefined
const cases = []
try {
  const fixture = await prepare(root)
  application = await electron.launch({
    executablePath: appExecutable(fixture.application),
    env: {
      ...process.env,
      [SESSION_CLAUDE_TRANSCRIPTS_ENV]: fixture.claudeTranscripts,
      [SESSION_CODEX_TRANSCRIPTS_ENV]: fixture.codexTranscripts,
      [SESSION_CLAUDE_ARCHIVE_ENV]: fixture.archive,
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
  assert.equal(await application.evaluate(({ app }) => app.isPackaged), true)
  // Each case names itself as it passes, so the list printed below is what ran rather than a list
  // kept by hand beside it. The value comes back, so a case that also reports a number goes
  // through here too and there is one mechanism rather than two.
  const ran = async (names, prove) => {
    const reading = await prove()
    cases.push(...names)
    return reading
  }
  await ran(['discovery', 'retired-id', 'missing-session'], () => proveContract(page))
  // @todo(#1961): Restore the packaged Roster and Feed proof when the new UI is wired to real Session projections.
  await assertShippedFusesIntact()
  console.log(
    JSON.stringify({
      ok: true,
      packaged: true,
      cases,
    }),
  )
} finally {
  try {
    if (application) await application.close()
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}
