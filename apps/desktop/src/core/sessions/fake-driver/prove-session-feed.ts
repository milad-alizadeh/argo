// The #1831 slice proves Session contracts over the real preload, not a dev server (#1910).
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron } from 'playwright-core'
import { ACCEPTANCE_ENV } from '../../../../scripts/acceptance-protocol.mjs'
import {
  provePackagedResume,
  writeFakeClaude,
} from '../../../agents/claude/session-fake-driver/session-resume-case'
import { provePackagedCodexResume } from '../../../agents/codex/session-fake-driver/codex-resume-case'
import { writeFakeCodex } from '../../../agents/codex/session-fake-driver/fixture-driver'
import { appExecutable, assertShippedFusesIntact } from '../../desktop-proof/packaged-test-copy'
import { PROJECT_PROOF_STORE_ENV } from '../../projects/fake-driver/project-proof-protocol'
import {
  SESSION_CLAUDE_ARCHIVE_ENV,
  SESSION_CLAUDE_EXECUTABLE_ENV,
  SESSION_CLAUDE_TRANSCRIPTS_ENV,
  SESSION_CODEX_EXECUTABLE_ENV,
  SESSION_CODEX_TRANSCRIPTS_ENV,
} from '../proof-protocol'
import {
  appendProse,
  growCodexTranscript,
  prepare,
  removeProse,
  streamProse,
} from './session-feed-fixture'
import { proveFormattedFeed } from './session-formatted-feed-case'
import { proveLiveFeed } from './session-live-feed-cases'
import { proveSessionPlan } from './session-plan-cases'
import { updatePlan } from './session-plan-fixture'
import { proveContract } from './session-roster-contract-case'
import {
  provePackagedRosterRestart,
  provePackagedRosterSelection,
} from './session-roster-interaction-cases'
import { proveStableRosterPolling } from './session-roster-order-case'
import { rosterOrderMutations } from './session-roster-order-fixture'
import { proveSessionShell } from './session-shell-cases'
import { proveToolCalls } from './session-tool-calls-case'
import { proveTurnSetup } from './session-turn-setup-cases'

const root = await mkdtemp(path.join(os.tmpdir(), 'argo-packaged-session-'))
const SESSION_VIEWPORT = { width: 1440, height: 860 }
let application: Awaited<ReturnType<typeof electron.launch>> | undefined
const cases = []
try {
  const fixture = await prepare(root)
  const fakeClaude = await writeFakeClaude(root, fixture.claudeTranscripts)
  const fakeCodex = await writeFakeCodex(root)
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
  let page = await launch()
  assert.equal(await application.evaluate(({ app }) => app.isPackaged), true)
  // Each passing case records its name.
  const ran = async (names, prove) => {
    const reading = await prove()
    cases.push(...names)
    return reading
  }
  await ran(['session-roster-contract'], () => proveContract(page))
  await ran(['session-shell'], () => proveSessionShell(page))
  await ran(['session-roster-selection'], () => provePackagedRosterSelection(page))
  await ran(['session-tool-calls'], () => proveToolCalls(page))
  await ran(['session-feed-reader-anchor'], () =>
    proveLiveFeed(page, {
      transcripts: fixture.claudeTranscripts,
      append: appendProse,
      stream: streamProse,
    }),
  )
  const formatted = await ran(['session-feed-formatted'], () =>
    proveFormattedFeed(page, {
      root,
      transcripts: fixture.claudeTranscripts,
      append: appendProse,
    }),
  )
  await ran(['session-plan'], () =>
    proveSessionPlan(page, () => updatePlan(fixture.claudeTranscripts)),
  )
  await ran(['session-turn-setup'], () => proveTurnSetup(page))
  await ran(['session-roster-stable-polling'], () =>
    proveStableRosterPolling(
      page,
      rosterOrderMutations({
        archive: fixture.archive,
        transcripts: fixture.claudeTranscripts,
      }),
    ),
  )
  await ran(['session-roster-restart'], () =>
    provePackagedRosterRestart(page, {
      remove: () => removeProse(fixture.claudeTranscripts),
      restart: async () => {
        page = await restart()
        return page
      },
      updateRoster: () => growCodexTranscript(fixture.codexTranscripts),
    }),
  )
  await ran(['session-claude-resume'], async () => {
    page = await provePackagedResume(page, {
      project: fixture.project,
      restart,
      transcripts: fixture.claudeTranscripts,
    })
  })
  await ran(['session-codex-resume'], async () => {
    page = await provePackagedCodexResume(page, { project: fixture.project, restart })
  })
  await assertShippedFusesIntact()
  console.log(JSON.stringify({ ok: true, packaged: true, cases, formatted }))
} finally {
  try {
    if (application) await application.close()
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}
