// The #1831 slice inside the SHIPPED app: discovery with no Project registration, the Feed
// contract over the real preload, and the ADR-0033 geometry rule that a row is measured in a
// hidden container before it is drawn. A dev-server run proves none of it.
//
// `--shots <dir>` writes the packaged screens for a person who wants to look at them. Nothing in
// CI passes it any more, and the PNG files are disposable: point it at a temporary directory and
// delete them (#1910). The screens a reviewer reads are the Storybook site, and the contract this
// file asserts is read out of the DOM, so no assertion here depends on a pixel.
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron } from 'playwright-core'
import { ACCEPTANCE_ENV } from '../../../../scripts/acceptance-protocol.mjs'
import {
  proveDamagedSession,
  proveGeometry,
  proveGrownSession,
  proveOwnedHeights,
  proveRepeatOpening,
} from '../../../agents/claude/session-fake-driver/session-geometry-cases'
import {
  provePaneDrag,
  proveWindowHoldsStill,
} from '../../../agents/claude/session-fake-driver/session-pane-cases'
import { appExecutable, assertShippedFusesIntact } from '../../desktop-proof/packaged-test-copy'
import { PROJECT_PROOF_STORE_ENV } from '../../projects/fake-driver/project-proof-protocol'
import {
  SESSION_CLAUDE_ARCHIVE_ENV,
  SESSION_CLAUDE_TRANSCRIPTS_ENV,
  SESSION_CODEX_TRANSCRIPTS_ENV,
} from '../proof-protocol'
import {
  proveCodexFeed,
  proveFirstOpen,
  proveNoMislabelledFeed,
  proveNoUnmeasuredRow,
  proveRendererAuthority,
} from './session-feed-cases'
import {
  appendProse,
  capture,
  growCodexTranscript,
  growStranded,
  openSessionsScreen,
  prepare,
  streamProse,
} from './session-feed-fixture'
import { writeFixtureTree } from './session-fixture-files'
import { proveLiveFeed } from './session-live-feed-cases'
import {
  proveArchive,
  proveCodexReread,
  proveContract,
  proveReread,
  proveRoster,
} from './session-roster-cases'

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
  await openSessionsScreen(page)
  const roster = await ran(['roster-focus', 'archive-section'], () => proveRoster(page))
  const geometry = await ran(['settled-geometry'], () => proveGeometry(page))
  await capture(page, application, 'roster-and-feed.png')
  await ran(['damaged-session'], () => proveDamagedSession(page))
  await capture(page, application, 'damaged-session.png')
  const firstOpen = await ran(['tail-position', 'selected-identity', 'text-selection'], () =>
    proveFirstOpen(page),
  )
  await capture(page, application, 'feed-at-the-tail.png')
  const owned = await ran(['owned-heights', 'settled-font'], () => proveOwnedHeights(page))
  const pane = await ran(['pane-drag'], () => provePaneDrag(page))
  await ran(['window-holds-still'], () => proveWindowHoldsStill(page))
  await ran(['repeat-opening'], () => proveRepeatOpening(page))
  await ran(['no-mislabelled-feed'], () => proveNoMislabelledFeed(page))
  await ran(['no-unmeasured-row'], () => proveNoUnmeasuredRow(page))
  const live = await ran(['live-feed-anchor', 'kept-feed'], () =>
    proveLiveFeed(page, {
      append: appendProse,
      stream: streamProse,
      transcripts: fixture.claudeTranscripts,
    }),
  )
  await ran(['codex-feed'], () => proveCodexFeed(page))
  await ran(['roster-reread'], () => proveReread(page, fixture.claudeTranscripts, writeFixtureTree))
  await ran(['grown-session'], () =>
    proveGrownSession(page, fixture.claudeTranscripts, growStranded),
  )
  await capture(page, application, 'roster-read-again.png')
  await ran(['archived-sessions'], () => proveArchive(page))
  await capture(page, application, 'roster-archived.png')
  await ran(['codex-reread'], () =>
    proveCodexReread(page, fixture.codexTranscripts, growCodexTranscript),
  )
  await ran(['renderer-authority'], () => proveRendererAuthority(page, application))
  await assertShippedFusesIntact()
  console.log(
    JSON.stringify({
      ok: true,
      packaged: true,
      sessions: roster.count,
      measuredRows: geometry.rowHeights.length,
      ownedRows: owned.rows,
      // First-draw evidence for #1863, read off the shipped app rather than a dev server, for the
      // first open of the `prose` fixture. Two numbers because one cannot answer both questions:
      // `measureMs` is the pass itself, and `settleMs` is what the reader waited, which carries
      // the three warm frames and the font wait as well. Reporting only the second would report a
      // fixed floor of about three frames as if it were the cost of laying out this Feed.
      measureMs: firstOpen.measureMs,
      settleMs: firstOpen.settleMs,
      pane,
      live,
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
