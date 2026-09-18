// Session Feed and Roster contracts over the packaged app's real preload (#1910).
import { completeWatch, writeWatchOutput } from '../../mocks/sessions/mock-shell-output'
import { assertShippedFusesIntact } from '../packaged-app'
import { proveBackgroundShell } from './cases/background-shell.case'
import { proveDelegationCards } from './cases/delegation-card.case'
import { proveSessionDiagram } from './cases/diagram.case'
import { proveFormattedFeed } from './cases/formatted-feed.case'
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
import { proveSearchFindsABuriedSession } from './cases/search.case'
import { proveSessionShell } from './cases/shell.case'
import { proveSubagentFeed } from './cases/subagent-feed.case'
import { proveToolCalls } from './cases/tool-calls.case'
import { proveTurnSetup } from './cases/turn-setup.case'
import { appendProse, growCodexTranscript, removeProse, streamProse } from './fixtures/feed.fixture'
import { updatePlan } from './fixtures/plan.fixture'
import { rosterOrderMutations } from './fixtures/roster-order.fixture'
import { writeWindowFillerSessions } from './fixtures/roster-window.fixture'
import { writeBuriedSearchTarget } from './fixtures/search-window.fixture'
import { test } from './session-proof-run'

test.describe('with no Project selected', () => {
  test.use({ projectSelected: false })

  test('session-no-project-window', async ({ session }) => {
    await proveNoProjectWindow(session.page())
  })
})

test('session-roster-contract', async ({ session }) => {
  await proveContract(session.page())
})

test('session-shell', async ({ session }) => {
  await proveSessionShell(session.page())
})

test('session-roster-selection', async ({ session }) => {
  await provePackagedRosterSelection(session.page())
})

test('session-tool-calls', async ({ session }) => {
  await proveToolCalls(session.page())
})

test('session-delegation-cards', async ({ session }) => {
  await proveDelegationCards(session.page())
})

test('session-subagent-feed', async ({ session }) => {
  await proveSubagentFeed(session.page())
})

test('session-background-shell', async ({ session }) => {
  await proveBackgroundShell(session.page(), {
    writeOutput: (text: string) => writeWatchOutput(session.root, text),
    complete: () => completeWatch(session.fixture.claudeTranscripts, session.root),
  })
})

test('session-question', async ({ session }) => {
  await proveSessionQuestion(session.page())
})

test('session-feed-reader-anchor', async ({ session }) => {
  await proveLiveFeed(session.page(), {
    transcripts: session.fixture.claudeTranscripts,
    append: appendProse,
    stream: streamProse,
  })
})

test('session-feed-formatted', async ({ session }) => {
  await proveFormattedFeed(session.page(), {
    root: session.root,
    transcripts: session.fixture.claudeTranscripts,
    append: appendProse,
  })
})

test('session-diagram', async ({ session }) => {
  await proveSessionDiagram(session.page(), {
    transcripts: session.fixture.claudeTranscripts,
    append: appendProse,
  })
})

test('session-plan', async ({ session }) => {
  await proveSessionPlan(session.page(), () => updatePlan(session.fixture.claudeTranscripts))
})

test('session-turn-setup', async ({ session }) => {
  await proveTurnSetup(session.page())
})

test('session-roster-stable-polling', async ({ session }) => {
  await proveStableRosterPolling(
    session.page(),
    rosterOrderMutations({ transcripts: session.fixture.claudeTranscripts }),
  )
})

test('session-roster-restart', async ({ session }) => {
  await provePackagedRosterRestart(session.page(), {
    remove: () => removeProse(session.fixture.claudeTranscripts),
    restart: () => session.restart(),
    updateRoster: () => growCodexTranscript(session.fixture.codexTranscripts),
  })
})

test('session-roster-window', async ({ session }) => {
  await writeWindowFillerSessions(session.fixture.claudeTranscripts, session.fixture.project)
  await proveRosterWindow(session.page())
})

test('session-search', async ({ session }) => {
  await writeWindowFillerSessions(session.fixture.claudeTranscripts, session.fixture.project)
  await writeBuriedSearchTarget(session.fixture.claudeTranscripts, session.fixture.project)
  await proveSearchFindsABuriedSession(session.page())
})

test('shipped fuses stay intact', async () => {
  await assertShippedFusesIntact()
})
