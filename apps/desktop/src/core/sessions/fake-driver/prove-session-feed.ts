// The #1831 slice proves Session contracts over the real preload, not a dev server (#1910).
import assert from 'node:assert/strict'
import type { Page } from 'playwright-core'
import { assertShippedFusesIntact } from '../../desktop-proof/packaged-test-copy'
import { createFakeSessionCliBackend } from './fake-session-cli-backend'
import { type PackagedSessionRun, runPackagedSessionProof } from './packaged-session-run'
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
import { proveSessionJourneys } from './session-journey-cases'
import { proveLiveFeed } from './session-live-feed-cases'
import { proveNewSessionWithNoProject } from './session-new-with-no-project-case'
import { proveSessionPlan } from './session-plan-cases'
import { updatePlan } from './session-plan-fixture'
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

// The cases that read a seeded transcript a real CLI never writes, so they run on the fake
// backend alone. Every one of them reads a `/Users/x` fixture a selected Project scopes out
// (#2204), so they all run before the journeys select one.
async function proveFeedCases({ fixture, ran, root }: PackagedSessionRun, page: Page) {
  await ran(['session-roster-contract'], () => proveContract(page))
  await ran(['session-shell'], () => proveSessionShell(page))
  await ran(['session-roster-selection'], () => provePackagedRosterSelection(page))
  await ran(['session-tool-calls'], () => proveToolCalls(page))
  await ran(['session-delegation-cards'], () => proveDelegationCards(page))
  await ran(['session-subagent-feed'], () => proveSubagentFeed(page))
  await ran(['session-background-shell'], () =>
    proveBackgroundShell(page, {
      writeOutput: (text: string) => writeWatchOutput(root, text),
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
    proveFormattedFeed(page, { root, transcripts: fixture.claudeTranscripts, append: appendProse }),
  )
  const diagramFixture = { transcripts: fixture.claudeTranscripts, append: appendProse }
  await ran(['session-diagram'], () => proveSessionDiagram(page, diagramFixture))
  await ran(['session-plan'], () =>
    proveSessionPlan(page, () => updatePlan(fixture.claudeTranscripts)),
  )
  await ran(['session-turn-setup'], () => proveTurnSetup(page))
  return formatted
}

async function proveRosterCases(run: PackagedSessionRun, opened: Page) {
  const { fixture, hold, ran, restart } = run
  let page = opened
  await ran(['session-roster-stable-polling'], () =>
    proveStableRosterPolling(
      page,
      rosterOrderMutations({ archive: fixture.archive, transcripts: fixture.claudeTranscripts }),
    ),
  )
  await ran(['session-roster-restart'], () =>
    provePackagedRosterRestart(page, {
      remove: () => removeProse(fixture.claudeTranscripts),
      restart: async () => {
        page = hold(await restart())
        return page
      },
      updateRoster: () => growCodexTranscript(fixture.codexTranscripts),
    }),
  )
  return page
}

const backend = createFakeSessionCliBackend()

await runPackagedSessionProof({
  name: 'packaged-session',
  backend,
  prove: async (run) => {
    const { fixture, hold, isPackaged, launch, ran, restart } = run
    let page = hold(await launch())
    assert.equal(await isPackaged(), true)
    // Before any Project is selected, so this cannot pass by accident on a Project the fixture
    // already carries (#2307).
    await ran(['session-new-with-no-project'], () => proveNewSessionWithNoProject(page))
    const formatted = await proveFeedCases(run, page)
    page = await proveRosterCases(run, page)
    // Every journey below starts a Session, which needs a selected Project (#2204).
    await selectProofProject(fixture.userData, fixture.project)
    page = hold(await restart())
    page = hold(await proveSessionJourneys({ page, ran, backend, fixture, restart }))
    // Last: enough Sessions to cross the Roster's page size land only now, so no earlier case's
    // own exact Roster counts or ordering has to account for them.
    await ran(['session-roster-window'], async () => {
      await writeWindowFillerSessions(fixture.claudeTranscripts, fixture.project)
      await proveRosterWindow(page)
    })
    await assertShippedFusesIntact()
    return { formatted }
  },
})
