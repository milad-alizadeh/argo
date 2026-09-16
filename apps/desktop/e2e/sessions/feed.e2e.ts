// The #1831 slice proves Session contracts over the real preload, not a dev server (#1910).
//
// Every case below shares one packaged launch and one fixture root (`session-proof-run.ts`), so
// this file is one ordered proof rather than independent tests: a case reads state an earlier one
// left behind, and a failure stops the ones after it (`test.describe.serial`).
import { expect, test } from '@playwright/test'
import { createMockSessionCliBackend } from '../../mocks/sessions/mock-session-cli-backend'
import { completeWatch, writeWatchOutput } from '../../mocks/sessions/shell.fixture'
import { assertShippedFusesIntact } from '../packaged-app'
import { proveBackgroundShell } from './cases/background-shell.case'
import { proveDelegationCards } from './cases/delegation-card.case'
import { proveSessionDiagram } from './cases/diagram.case'
import { proveFormattedFeed } from './cases/formatted-feed.case'
import { defineSessionJourneyCases } from './cases/journeys.case'
import { proveLiveFeed } from './cases/live-feed.case'
import { proveNoProjectWindow } from './cases/no-project.case'
import { proveSessionPlan } from './cases/plan.case'
import { proveSessionQuestion } from './cases/question.case'
import { proveContract } from './cases/roster-contract.case'
import {
  provePackagedRosterRestart,
  provePackagedRosterSelection,
} from './cases/roster-interaction.case'
import { proveStableRosterPolling } from './cases/roster-order.case'
import { proveRosterWindow } from './cases/roster-window.case'
import { proveSessionShell } from './cases/shell.case'
import { proveSubagentFeed } from './cases/subagent-feed.case'
import { proveToolCalls } from './cases/tool-calls.case'
import { proveTurnSetup } from './cases/turn-setup.case'
import {
  appendProse,
  growCodexTranscript,
  removeProse,
  selectProofProject,
  streamProse,
} from './fixtures/feed.fixture'
import { updatePlan } from './fixtures/plan.fixture'
import { rosterOrderMutations } from './fixtures/roster-order.fixture'
import { writeWindowFillerSessions } from './fixtures/roster-window.fixture'
import type { PageBox, SessionProofRun } from './session-proof-run'
import { createPageBox, describeSessionProof } from './session-proof-run'

const backend = createMockSessionCliBackend()

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

  test('session-no-project-window', async () => {
    await proveNoProjectWindow(box.get())
  })

  // Every case below reads the Roster, which only a selected Project shows (#2307).
  test('select-project-and-restart', async () => {
    await selectProofProject(run.fixture.userData, run.fixture.project)
    box.set(await restart())
  })

  registerRosterAndShellCases(run, box)
  registerFeedAndPlanCases(run, box)

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

// The cases that read a seeded transcript a real CLI never writes, so they run on the mock backend alone.
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

// Continues the fixture-only group `registerRosterAndShellCases` starts.
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
