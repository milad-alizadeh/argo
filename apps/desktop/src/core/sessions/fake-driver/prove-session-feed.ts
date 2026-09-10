// The #1831 slice inside the SHIPPED app: discovery with no Project registration, the Feed
// contract over the real preload, and the ADR-0033 geometry rule that a row is measured in a
// hidden container before it is drawn. A dev-server run proves none of it.
//
// `--shots <dir>` writes the packaged screens for a person who wants to look at them. Nothing in
// CI passes it any more, and the PNG files are disposable: point it at a temporary directory and
// delete them (#1910). The screens a reviewer reads are the Storybook site, and the contract this
// file asserts is read out of the DOM, so no assertion here depends on a pixel.
import assert from 'node:assert/strict'
import { appendFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron } from 'playwright-core'
import { ACCEPTANCE_ENV } from '../../../../scripts/acceptance-protocol.mjs'
import {
  appExecutable,
  assertShippedFusesIntact,
  packagedTestCopy,
} from '../../desktop-proof/packaged-test-copy'
import { PROJECT_PROOF_STORE_ENV } from '../../projects/fake-driver/project-proof-protocol'
import { SESSION_CLAUDE_TRANSCRIPTS_ENV, SESSION_CODEX_TRANSCRIPTS_ENV } from '../proof-protocol'
import { proveCodexFeed, proveRendererAuthority } from './session-feed-cases'
import { CODEX_FIXTURES, writeFixtureTree } from './session-fixture-files'
import { proveCodexReread, proveContract } from './session-roster-cases'

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
const CODEX_FIXTURE_NAMES = ['rollout-codexParent', 'rollout-codexChild']

const shotsIndex = process.argv.indexOf('--shots')
const shots = shotsIndex === -1 ? null : (process.argv[shotsIndex + 1] ?? null)

async function prepare(root) {
  const application = await packagedTestCopy(root)
  const claudeTranscripts = path.join(root, 'claude-transcripts')
  const codexTranscripts = path.join(root, 'codex-transcripts')
  await writeFixtureTree(claudeTranscripts, FIXTURES)
  await writeFixtureTree(codexTranscripts, CODEX_FIXTURE_NAMES, {
    directory: '2026/09/10',
    fixtures: CODEX_FIXTURES,
  })
  const userData = path.join(root, 'userData')
  await mkdir(userData, { recursive: true })
  return { application, claudeTranscripts, codexTranscripts, userData }
}

async function growCodexTranscript(transcripts) {
  await appendFile(
    path.join(transcripts, '2026', '09', '10', 'rollout-codexParent.jsonl'),
    `${JSON.stringify({
      timestamp: '2099-01-01T00:00:00.000Z',
      type: 'event_msg',
      payload: {
        type: 'agent_message',
        thread_id: 'rollout-codexParent',
        item: {
          type: 'AgentMessage',
          id: 'live-codex-message',
          content: [{ type: 'text', text: 'The Codex transcript changed while Argo was open.' }],
        },
      },
    })}\n`,
  )
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

async function proveSessionsScreen(page, application) {
  await page.click('nav[aria-label="Surfaces"] button:has-text("Sessions")')
  await page.waitForSelector('nav[aria-label="Sessions"] button')
  const empty = await page.evaluate(() => ({
    sessions: document.querySelectorAll('nav[aria-label="Sessions"] button').length,
    message: document.querySelector('[data-component="SessionsEmptyState"] p')?.textContent,
  }))
  assert.equal(empty.sessions, 7)
  assert.equal(empty.message, 'Select a session to read its terminal activity.')
  await capture(page, application, 'sessions-empty.png')

  await page.click('button:has-text("askPending")')
  await page.waitForSelector('[aria-label="Session activity"] article')
  const selected = await page.evaluate(() => ({
    activityRows: document.querySelectorAll('[aria-label="Session activity"] article').length,
    empty: document.querySelector('[data-component="SessionsEmptyState"] p')?.textContent ?? '',
  }))
  assert.equal(selected.activityRows > 0, true)
  assert.equal(selected.empty, '')
  await capture(page, application, 'session-activity.png')
}

const root = await mkdtemp(path.join(os.tmpdir(), 'argo-packaged-session-'))
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
  await ran(['codex-feed'], () => proveCodexFeed(page))
  await ran(['empty-state', 'session-activity'], () => proveSessionsScreen(page, application))
  await ran(['codex-reread'], () =>
    proveCodexReread(page, fixture.codexTranscripts, growCodexTranscript),
  )
  await ran(['renderer-authority'], () => proveRendererAuthority(page, application))
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
