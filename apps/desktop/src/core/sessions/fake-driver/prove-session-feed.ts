// The #1831 slice proves Session contracts over the real preload, not a dev server (#1910).
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { proveClaudeRename } from '../../../agents/claude/session-fake-driver/session-rename-case'
import { provePackagedResume } from '../../../agents/claude/session-fake-driver/session-resume-case'
import { provePackagedCodexResume } from '../../../agents/codex/session-fake-driver/codex-resume-case'
import { assertShippedFusesIntact } from '../../desktop-proof/packaged-test-copy'
import { createCaseRunner } from './packaged-case-runner'
import { createPackagedSessionHarness } from './packaged-session-harness'
import { proveBackgroundShell } from './session-background-shell-case'
import { proveSessionCreatedByClick } from './session-create-case'
import { proveDelegationCards } from './session-delegation-card-case'
import { proveSessionDiagram } from './session-diagram-case'
import {
  appendProse,
  growCodexTranscript,
  openSessionsScreen,
  removeProse,
  streamProse,
} from './session-feed-fixture'
import { proveFormattedFeed } from './session-formatted-feed-case'
import { proveLiveFeed } from './session-live-feed-cases'
import { proveSessionPlan } from './session-plan-cases'
import { updatePlan } from './session-plan-fixture'
import { proveSessionQuestion } from './session-question-case'
import { proveDuplicateSend, proveReplyWait } from './session-reply-delay-case'
import { proveContract } from './session-roster-contract-case'
import {
  provePackagedRosterRestart,
  provePackagedRosterSelection,
} from './session-roster-interaction-cases'
import { proveStableRosterPolling } from './session-roster-order-case'
import { rosterOrderMutations } from './session-roster-order-fixture'
import { proveSessionShell } from './session-shell-cases'
import { completeWatch, writeWatchOutput } from './session-shell-fixture'
import { proveSubagentFeed } from './session-subagent-feed-case'
import { proveToolCalls } from './session-tool-calls-case'
import { proveTurnSetup } from './session-turn-setup-cases'

const root = await mkdtemp(path.join(os.tmpdir(), 'argo-packaged-session-'))
let delayedRoot: string | undefined
const cases = []
let harness: Awaited<ReturnType<typeof createPackagedSessionHarness>> | undefined
try {
  const started = await createPackagedSessionHarness(root)
  harness = started
  const { fixture, launch, restart, isPackaged } = started
  let page = await launch()
  assert.equal(await isPackaged(), true)
  const ran = createCaseRunner(
    cases,
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
  // Before the resume cases, for the reason session-create-case.ts records.
  await ran(['session-created-by-click'], () =>
    proveSessionCreatedByClick(page, fixture.claudeTranscripts),
  )
  await ran(['session-claude-resume'], async () => {
    page = await provePackagedResume(page, {
      project: fixture.project,
      restart,
      transcripts: fixture.claudeTranscripts,
    })
  })
  await ran(['session-codex-resume'], async () => {
    page = await provePackagedCodexResume(page, { restart })
  })
  await ran(['session-claude-rename'], () =>
    proveClaudeRename(page, { project: fixture.project, transcripts: fixture.claudeTranscripts }),
  )
  await harness.close()
  delayedRoot = await mkdtemp(path.join(os.tmpdir(), 'argo-packaged-session-'))
  const delayed = await createPackagedSessionHarness(delayedRoot, { replyDelayMs: 2_000 })
  harness = delayed
  page = await delayed.launch()
  await openSessionsScreen(page)
  await ran(['session-reply-wait'], () => proveReplyWait(page, delayed.fixture.claudeTranscripts))
  await ran(['session-duplicate-send'], () =>
    proveDuplicateSend(page, delayed.fixture.claudeTranscripts),
  )
  await assertShippedFusesIntact()
  console.log(JSON.stringify({ ok: true, packaged: true, cases, formatted }))
} finally {
  try {
    await harness?.close()
  } finally {
    await rm(root, { recursive: true, force: true })
    if (delayedRoot !== undefined) await rm(delayedRoot, { recursive: true, force: true })
  }
}
