// The #1831 slice proves Session contracts over the real preload, not a dev server (#1910).
//
// Every case below shares one packaged launch and one fixture root (`session-proof-run.ts`), so
// this file is one ordered proof rather than independent tests: a case reads state an earlier one
// left behind, and a failure stops the ones after it (`test.describe.serial`).
import { expect, test } from '@playwright/test'
import { assertShippedFusesIntact } from '../../desktop-proof/packaged-test-copy'
import { createFakeSessionCliBackend } from './fake-session-cli-backend'
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
import { defineSessionJourneyCases } from './session-journey-cases'
import { proveLiveFeed } from './session-live-feed-cases'
import { proveSessionPlan } from './session-plan-cases'
import { updatePlan } from './session-plan-fixture'
import type { PageBox, SessionProofRun } from './session-proof-run'
import { createPageBox, describeSessionProof } from './session-proof-run'
import { proveSessionQuestion } from './session-question-case'
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

const backend = createFakeSessionCliBackend()

describeSessionProof('packaged-session', backend, (run) => {
  // `fixture` stays on `run` rather than destructured here: this callback runs once, at
  // describe-registration time, before `beforeAll` assigns the harness the getter reads
  // (`session-proof-run.ts`). Every `run.fixture` access below happens inside a test body instead,
  // once the harness is real.
  const { hold, isPackaged, launch, restart } = run
  const box = createPageBox(hold)

  test('launch', async () => {
    box.set(await launch())
    expect(await isPackaged()).toBe(true)
  })

  registerRosterAndShellCases(run, box)
  registerFeedAndPlanCases(run, box)

  // Every journey below starts a Session, which needs a selected Project (#2204).
  test('select-project-and-restart', async () => {
    await selectProofProject(run.fixture.userData, run.fixture.project)
    box.set(await restart())
  })

  defineSessionJourneyCases({ backend, fixture: () => run.fixture, restart, box })

  // Last: enough Sessions to cross the Roster's page size land only now, so no earlier case's own
  // exact Roster counts or ordering has to account for them.
  test('session-roster-window', async () => {
    await writeWindowFillerSessions(run.fixture.claudeTranscripts, run.fixture.project)
    await proveRosterWindow(box.get())
  })

  test('shipped fuses stay intact', async () => {
    await assertShippedFusesIntact()
  })
})

// Every case here reads a `/Users/x` fixture a selected Project scopes out (#2204), so all of them
// run before `select-project-and-restart` below.
function registerRosterAndShellCases(run: SessionProofRun, box: PageBox) {
  test('session-roster-contract', async () => {
    await proveContract(box.get())
  })
  test('session-shell', async () => {
    await proveSessionShell(box.get())
  })
  test('session-roster-selection', async () => {
    await provePackagedRosterSelection(box.get())
  })
  test('session-tool-calls', async () => {
    await proveToolCalls(box.get())
  })
  test('session-delegation-cards', async () => {
    await proveDelegationCards(box.get())
  })
  test('session-subagent-feed', async () => {
    await proveSubagentFeed(box.get())
  })
  test('session-background-shell', async () => {
    await proveBackgroundShell(box.get(), {
      writeOutput: (text: string) => writeWatchOutput(run.root, text),
      complete: () => completeWatch(run.fixture.claudeTranscripts, run.root),
    })
  })
}

// Continues the pre-Project group `registerRosterAndShellCases` starts.
function registerFeedAndPlanCases(run: SessionProofRun, box: PageBox) {
  test('session-question', async () => {
    await proveSessionQuestion(box.get())
  })
  test('session-feed-reader-anchor', async () => {
    await proveLiveFeed(box.get(), {
      transcripts: run.fixture.claudeTranscripts,
      append: appendProse,
      stream: streamProse,
    })
  })
  test('session-feed-formatted', async () => {
    await proveFormattedFeed(box.get(), {
      root: run.root,
      transcripts: run.fixture.claudeTranscripts,
      append: appendProse,
    })
  })
  test('session-diagram', async () => {
    await proveSessionDiagram(box.get(), {
      transcripts: run.fixture.claudeTranscripts,
      append: appendProse,
    })
  })
  test('session-plan', async () => {
    await proveSessionPlan(box.get(), () => updatePlan(run.fixture.claudeTranscripts))
  })
  test('session-turn-setup', async () => {
    await proveTurnSetup(box.get())
  })
  test('session-roster-stable-polling', async () => {
    await proveStableRosterPolling(
      box.get(),
      rosterOrderMutations({
        archive: run.fixture.archive,
        transcripts: run.fixture.claudeTranscripts,
      }),
    )
  })
  test('session-roster-restart', async () => {
    await provePackagedRosterRestart(box.get(), {
      remove: () => removeProse(run.fixture.claudeTranscripts),
      restart: async () => box.set(await run.restart()),
      updateRoster: () => growCodexTranscript(run.fixture.codexTranscripts),
    })
  })
}
