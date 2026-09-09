// The #1831 slice inside the SHIPPED app: discovery with no Project registration, the Feed
// contract over the real preload, and the ADR-0033 geometry rule that a row is measured in a
// hidden container before it is drawn. A dev-server run proves none of it.
//
// `--shots <dir>` writes the packaged visual evidence. CI passes it and keeps the captures as an
// artifact, so the screens a change draws are evidence every run produces rather than evidence
// somebody remembered to produce by hand.
import assert from 'node:assert/strict'
import { appendFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron } from 'playwright-core'
import { ACCEPTANCE_ENV } from './acceptance-protocol.mjs'
import { appExecutable, assertShippedFusesIntact, packagedTestCopy } from './packaged-test-copy.mjs'
import { PROJECT_PROOF_STORE_ENV } from './project-proof-protocol.mjs'
import {
  proveFirstOpen,
  proveNoMislabelledFeed,
  proveNoUnmeasuredRow,
  proveRendererAuthority,
} from './session-feed-cases.mjs'
import { fixturePath, writeFixtureTree } from './session-fixture-files.mjs'
import {
  proveDamagedSession,
  proveGeometry,
  proveGrownSession,
  proveOwnedHeights,
  proveRepeatOpening,
} from './session-geometry-cases.mjs'
import { SESSION_TRANSCRIPTS_ENV } from './session-proof-protocol.mjs'
import { proveContract, proveReread, proveRoster } from './session-roster-cases.mjs'

const FIXTURES = [
  'resumeParent',
  'resumeChild',
  'externalBasic',
  'unparseableBody',
  'askPending',
  'prose',
  // Resumes a leaf that is in no file here, which is what a chain looks like when the Roster's
  // file cap stops short of its origin. Its row has to say so.
  'strandedResume',
]

const shots = process.argv.includes('--shots')
  ? process.argv[process.argv.indexOf('--shots') + 1]
  : null

// One more turn on a Session already measured, written the way the CLI writes one: appended to
// the file it belongs to.
const GROWN_TURN = `${JSON.stringify({
  type: 'assistant',
  cwd: '/Users/x/stranded',
  gitBranch: 'main',
  timestamp: '2026-08-20T09:30:00.000Z',
  uuid: 'sr-asst-2',
  parentUuid: 'sr-asst-1',
  message: {
    role: 'assistant',
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: 'And one more turn, written while Argo was looking.' }],
  },
})}\n`

async function growStranded(transcripts) {
  await appendFile(fixturePath(transcripts, 'strandedResume'), GROWN_TURN)
}

async function prepare(root) {
  const application = await packagedTestCopy(root)
  const transcripts = path.join(root, 'transcripts')
  await writeFixtureTree(transcripts, FIXTURES)
  const userData = path.join(root, 'userData')
  await mkdir(userData, { recursive: true })
  return { application, transcripts, userData }
}

// The packaged visual evidence. The window is shown from here rather than by the app, so every
// contract case above still runs against the same hidden window the other proofs use.
async function capture(page, application, name) {
  if (shots === null) return
  await mkdir(shots, { recursive: true })
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].show())
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(shots, name) })
}

const root = await mkdtemp(path.join(os.tmpdir(), 'argo-packaged-session-'))
let application
const cases = []
try {
  const fixture = await prepare(root)
  application = await electron.launch({
    executablePath: appExecutable(fixture.application),
    env: {
      ...process.env,
      [SESSION_TRANSCRIPTS_ENV]: fixture.transcripts,
      [PROJECT_PROOF_STORE_ENV]: fixture.userData,
      [ACCEPTANCE_ENV]: '0',
    },
    timeout: 30_000,
  })
  const page = await application.firstWindow()
  page.setDefaultTimeout(30_000)
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
  const roster = await ran(['roster-focus', 'partial-chain'], () => proveRoster(page))
  const geometry = await ran(['settled-geometry'], () => proveGeometry(page))
  await capture(page, application, 'roster-and-feed.png')
  await ran(['damaged-session'], () => proveDamagedSession(page))
  await capture(page, application, 'damaged-session.png')
  const firstOpen = await ran(['tail-position', 'selected-identity', 'text-selection'], () =>
    proveFirstOpen(page),
  )
  await capture(page, application, 'feed-at-the-tail.png')
  const owned = await ran(['owned-heights', 'settled-font'], () => proveOwnedHeights(page))
  await ran(['repeat-opening'], () => proveRepeatOpening(page))
  await ran(['no-mislabelled-feed'], () => proveNoMislabelledFeed(page))
  await ran(['no-unmeasured-row'], () => proveNoUnmeasuredRow(page))
  await ran(['roster-reread'], () => proveReread(page, fixture.transcripts, writeFixtureTree))
  await ran(['grown-session'], () => proveGrownSession(page, fixture.transcripts, growStranded))
  await capture(page, application, 'roster-read-again.png')
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
