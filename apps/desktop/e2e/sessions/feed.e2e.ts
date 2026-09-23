import path from 'node:path'
// Session Feed and Roster contracts over the packaged app's real preload (#1910).
// One file, one `test`: `sessionBackend` (`session-proof-run.ts`) is the only difference between
// a mock and a real Claude/Codex CLI, so a case that drives a live Turn just names the backend it
// needs and lets the project (`sessions` or `real-sessions`, `playwright.config.ts`) decide which
// one it gets, rather than living in a second curated file (#e2e-real-cheap-models).
import { completeWatch, writeWatchOutput } from '../../mocks/sessions/mock-shell-output'
import { assertShippedFusesIntact } from '../packaged-app'
import { proveBackgroundShell } from './cases/background-shell.case'
import { proveClaudeRename } from './cases/claude-rename.case'
import { provePackagedResume } from './cases/claude-resume.case'
import { provePackagedCodexResume } from './cases/codex-resume.case'
import { proveCodexThreadName } from './cases/codex-thread-name.case'
import { proveSessionCreatedByClick } from './cases/create.case'
import { proveDelegationCards } from './cases/delegation-card.case'
import { proveSessionDiagram } from './cases/diagram.case'
import { proveFormattedFeed } from './cases/formatted-feed.case'
import { provePackagedIndexRecovery } from './cases/index-recovery.case'
import { proveLiveFeed } from './cases/live-feed.case'
import { proveNoProjectWindow } from './cases/no-project.case'
import { proveSessionPlan } from './cases/plan.case'
import { provePromptLatency } from './cases/prompt-latency.case'
import { proveSessionQuestion } from './cases/question.case'
import { proveDuplicateSend, proveReplyWait } from './cases/reply-delay.case'
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
import { proveComposerMemory, proveTurnSetup } from './cases/turn-setup.case'
import { rosterRow } from './claude-proof-helpers'
import { appendProse, removeProse, streamProse } from './fixtures/feed.fixture'
import { updatePlan } from './fixtures/plan.fixture'
import { rosterOrderMutations } from './fixtures/roster-order.fixture'
import { writeWindowFillerSessions } from './fixtures/roster-window.fixture'
import { writeBuriedSearchTarget } from './fixtures/search-window.fixture'
import { openSessionByClick } from './gestures'
import { assertTranscriptFeedCorpus } from './real-harness/transcript-feed-corpus'
import { expect, test } from './session-proof-run'

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

test('session-created-by-click', async ({ session, backend }) => {
  await proveSessionCreatedByClick(session.page(), backend)
})

test.describe('with the real Claude SDK history', () => {
  test.skip(({ sessionBackend }) => sessionBackend !== 'real', 'Requires a signed-in Claude CLI.')

  test('session-sdk-history-real', async ({ session, backend }) => {
    const sessionId = await proveSessionCreatedByClick(session.page(), backend)
    const restarted = await session.restart()
    const [watched] = await rosterRow(restarted, sessionId)
    expect(watched?.posture).toBe('watched')
    await openSessionByClick(restarted, sessionId)
    await restarted.waitForSelector(`.feed__viewport[data-session="${sessionId}"] [data-feed-row]`)
    const prompt = 'Continue the watched SDK history with one short acknowledgement.'
    const composer = restarted.getByRole('combobox', { name: 'Message' })
    await composer.click()
    await restarted.keyboard.type(prompt)
    await restarted.getByRole('button', { name: 'Send message' }).click()
    await backend.waitForReply(restarted, { harness: 'claude', prompt })
    const [managed] = await rosterRow(restarted, sessionId)
    expect(managed?.posture).toBe('managed')
  })
})

// A skip that reads only the worker's backend decides before the case launches anything.
test.describe('with a real Codex', () => {
  test.skip(({ sessionBackend }) => sessionBackend === 'mock', 'session-codex-resume creates one.')

  test('session-codex-created-by-click', async ({ session, backend }) => {
    await proveSessionCreatedByClick(session.page(), backend, { harness: 'codex' })
  })
})

test.describe('with real Session transcript corpora', () => {
  test.skip(({ sessionBackend }) => sessionBackend !== 'real', 'Requires both signed-in CLIs.')

  test('session-feed-transcript-corpus', async ({ session, backend }) => {
    const claudeSessionId = await proveSessionCreatedByClick(session.page(), backend, {
      harness: 'claude',
      prompt: 'Use a shell command to print hello, then report the output.',
      budgetRunSetup: true,
    })
    const codexSessionId = await proveSessionCreatedByClick(session.page(), backend, {
      harness: 'codex',
      prompt: 'Use a shell command to print hello, then report the output.',
      budgetRunSetup: true,
    })
    const home = path.join(session.root, 'home')
    await assertTranscriptFeedCorpus(
      {
        claude: path.join(home, '.claude', 'projects'),
        codex: path.join(home, '.codex', 'sessions'),
      },
      { claude: claudeSessionId, codex: codexSessionId },
    )
  })
})

test('session-composer-memory', async ({ session }) => {
  await proveComposerMemory(session.page())
})

test('session-claude-resume', async ({ session, backend }) => {
  await provePackagedResume(session.page(), {
    backend,
    project: session.fixture.project,
    restart: session.restart,
    transcripts: session.fixture.claudeTranscripts,
  })
})

test('session-codex-resume', async ({ session, backend }) => {
  await provePackagedCodexResume(session.page(), { backend, restart: session.restart })
})

test.describe('session-claude-rename', () => {
  // The rename read-back checks `mock-claude/<id>.jsonl` directly (#2134): a real Claude writes
  // its own transcript somewhere under the real CLI's home, not that fixture layout.
  test.skip(({ sessionBackend }) => sessionBackend !== 'mock', 'Reads the mock transcript path.')

  test('session-claude-rename', async ({ session, backend }) => {
    await proveClaudeRename(session.page(), {
      backend,
      project: session.fixture.project,
      transcripts: session.fixture.claudeTranscripts,
    })
  })
})

test('session-codex-thread-name', async ({ session }) => {
  await proveCodexThreadName(session.page(), session.fixture.codexTranscripts)
})

test('session-index-recovery', async ({ session }) => {
  await provePackagedIndexRecovery(session.page(), {
    restart: session.restart,
    userData: session.fixture.userData,
  })
})

test.describe('with a slow Harness', () => {
  test.use({ slowReply: true })

  test('session-reply-wait', async ({ session, backend }) => {
    await proveReplyWait(session.page(), backend)
  })

  test('session-prompt-latency', async ({ session, backend }) => {
    await provePromptLatency(session.page(), backend)
  })

  test('session-duplicate-send', async ({ session, backend }) => {
    await proveDuplicateSend(session.page(), backend)
  })
})

test('shipped fuses stay intact', async () => {
  await assertShippedFusesIntact()
})
