// The #1831 slice proves Session contracts over the real preload, not a dev server (#1910).
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { proveCodexThreadName } from '../../../agents/codex/session-fake-driver/codex-thread-name-case'
import { assertShippedFusesIntact } from '../../desktop-proof/packaged-test-copy'
import { type CaseResults, createCaseRunner } from './packaged-case-runner'
import { createPackagedSessionHarness } from './packaged-session-harness'
import { proveBackgroundShell } from './session-background-shell-case'
import { proveDelegationCards } from './session-delegation-card-case'
import { proveSessionDiagram } from './session-diagram-case'
import {
  appendProse,
  growCodexTranscript,
  removeProse,
  selectProofProject,
  streamProse,
} from './session-feed-fixture'
import { proveFormattedFeed } from './session-formatted-feed-case'
import { proveLiveFeed } from './session-live-feed-cases'
import { proveSessionPlan } from './session-plan-cases'
import { updatePlan } from './session-plan-fixture'
import { proveSessionQuestion } from './session-question-case'
import { proveDuplicateSend, proveReplyWait } from './session-reply-delay-case'
import { proveResumeAndRenameFlow } from './session-resume-rename-flow'
import { proveContract } from './session-roster-contract-case'
import {
  provePackagedRosterRestart,
  provePackagedRosterSelection,
} from './session-roster-interaction-cases'
import { proveStableRosterPolling } from './session-roster-order-case'
import { rosterOrderMutations } from './session-roster-order-fixture'
import { proveRosterWindow } from './session-roster-window-case'
import { writeWindowFillerSessions } from './session-roster-window-fixture'
import { proveSessionShell } from './session-shell-cases'
import { completeWatch, writeWatchOutput } from './session-shell-fixture'
import { proveSubagentFeed } from './session-subagent-feed-case'
import { proveToolCalls } from './session-tool-calls-case'
import { proveTurnSetup } from './session-turn-setup-cases'

const root = await mkdtemp(path.join(os.tmpdir(), 'argo-packaged-session-'))
const results: CaseResults = { cases: [], timings: {} }
const provingStarted = performance.now()
let harness: Awaited<ReturnType<typeof createPackagedSessionHarness>> | undefined
try {
  const started = await createPackagedSessionHarness(root)
  harness = started
  const { fixture, launch, restart, isPackaged } = started
  let page = await launch()
  assert.equal(await isPackaged(), true)
  const ran = createCaseRunner(
    results,
    () => page,
    () => harness,
  )
  await ran(['session-roster-contract'], () => proveContract(page))
  await ran(['session-shell'], () => proveSessionShell(page))
  await ran(['session-roster-selection'], () => provePackagedRosterSelection(page))
  await ran(['session-tool-calls'], () => proveToolCalls(page))
  await ran(['session-delegation-cards'], () => proveDelegationCards(page))
  await ran(['session-subagent-feed'], () => proveSubagentFeed(page))
  await ran(['session-background-shell'], () =>
    proveBackgroundShell(page, {
      writeOutput: (text) => writeWatchOutput(root, text),
      complete: () => completeWatch(fixture.claudeTranscripts, root),
    }),
  )
  await ran(['session-question'], () => proveSessionQuestion(page))
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
  const diagramFixture = { transcripts: fixture.claudeTranscripts, append: appendProse }
  await ran(['session-diagram'], () => proveSessionDiagram(page, diagramFixture))
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
  // Every case above reads `/Users/x` fixtures a selected Project scopes out (#2204); every case
  // below starts a Session, which needs one.
  await selectProofProject(fixture.userData, fixture.project)
  page = await restart()
  page = await proveResumeAndRenameFlow({ page, ran, fixture, restart })
  // Each case below starts its own Session with its own prompt, so the fixture root carries over.
  page = await restart({ replyDelayMs: 2_000 })
  await ran(['session-reply-wait'], () => proveReplyWait(page, fixture.claudeTranscripts))
  await ran(['session-duplicate-send'], () => proveDuplicateSend(page, fixture.claudeTranscripts))
  // Last, because naming the Codex row changes the title the cases above open it by.
  await ran(['session-codex-thread-name'], () =>
    proveCodexThreadName(page, fixture.codexTranscripts),
  )
  // Last: enough Sessions to cross the Roster's page size land only now, so no earlier case's own
  // exact Roster counts or ordering has to account for them.
  await ran(['session-roster-window'], async () => {
    await writeWindowFillerSessions(fixture.claudeTranscripts, fixture.project)
    await proveRosterWindow(page)
  })
  // Naming the Codex row changes the title the cases above open it by.
  await ran(['session-codex-thread-name'], () =>
    proveCodexThreadName(page, fixture.codexTranscripts),
  )
  await assertShippedFusesIntact()
  const timings = {
    total: Math.round(performance.now() - provingStarted),
    launches: started.launches(),
    cases: results.timings,
  }
  const { cases } = results
  console.log(JSON.stringify({ ok: true, packaged: true, cases, formatted, timings }))
} finally {
  try {
    await harness?.close()
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}
