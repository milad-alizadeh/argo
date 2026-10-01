// Session Feed and Session List contracts over the packaged app's real preload (#1910).
// One file, one `test`: `sessionBackend` (`session-proof-run.ts`) is the only difference between
// a mock and a real Claude/Codex CLI, so a case that drives a live Turn just names the backend it
// needs and lets the project (`sessions` or `real-sessions`, `playwright.config.ts`) decide which
// one it gets, rather than living in a second curated file (#e2e-real-cheap-models).
import { rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { RECORDED_PROMPTS } from '../../mocks/cli/recorded-prompts'
import { packagedRun } from '../application-under-test'
import { assertShippedFusesIntact } from '../packaged-app'
import { proveClaudeAcpHistory } from './cases/claude-acp-history.case'
import { proveClaudeAcpControls, proveClaudeAcpDiscovery } from './cases/claude-acp-session.case'
import { proveClaudeRename } from './cases/claude-rename.case'
import { provePackagedCodexResume } from './cases/codex-resume.case'
import { proveCodexThreadName } from './cases/codex-thread-name.case'
import { proveSessionCreatedByClick } from './cases/create.case'
import { proveDelegationCards } from './cases/delegation-card.case'
import { proveSessionDiagram } from './cases/diagram.case'
import { proveFormattedFeed } from './cases/formatted-feed.case'
import { proveNewSessionSkipsUninstalledHarness } from './cases/new-session-harness.case'
import { proveNoProjectWindow } from './cases/no-project.case'
import { provePromptBeforeNaming } from './cases/pending-prompt.case'
import { provePromptLatency } from './cases/prompt-latency.case'
import { proveRemovedWorkLocation } from './cases/removed-work-location.case'
import { proveDuplicateSend, proveReplyWait } from './cases/reply-delay.case'
import { proveContract } from './cases/session-list-contract.case'
import { provePackagedSessionListSelection } from './cases/session-list-interaction.case'
import { proveSessionListWindow } from './cases/session-list-window.case'
import { proveSessionShell } from './cases/shell.case'
import { proveSubagentFeed } from './cases/subagent-feed.case'
import { proveLiveCodexModelChoices } from './cases/turn-configuration.case'
import { ACTIVE_FEED } from './feed-selectors'
import { appendProse } from './fixtures/feed.fixture'
import { writeWindowFillerSessions } from './fixtures/session-list-window.fixture'
import { openSessionByClick } from './gestures'
import { sessionSyncHoldFile } from './packaged-session-harness'
import { sessionDetails, sessionRows } from './page-trpc'
import { assertVendorFeedCorpus, readRealVendorCorpus } from './real-harness/vendor-feed-corpus'
import { expect, test } from './session-proof-run'

test.describe('with no Project selected', () => {
  test.use({ projectSelected: false })

  test('session-no-project-window', async ({ session }) => {
    await proveNoProjectWindow(session.page())
  })
})

test('session-list-contract', async ({ session }) => {
  await proveContract(session.page())
})

test('session-created-by-click', async ({ session, backend }) => {
  await proveSessionCreatedByClick(session.page(), backend)
})

test('session-shell', async ({ session }) => {
  await proveSessionShell(session.page())
})

test('session-removed-work-location', async ({ session }) => {
  await proveRemovedWorkLocation(session.page(), session.fixture.project)
})

test.describe('session refresh progress', () => {
  test.use({
    sessionSyncFixture: {
      records: [
        {
          sessionId: 'bb458b6d-bcf3-4fe6-9586-65930e6185a0',
          summary: 'Refresh Sessions visibly',
          firstPrompt: 'Refresh Sessions visibly',
          lastModified: Date.now(),
          cwd: '$PROJECT',
        },
      ],
    },
  })

  test('Refresh shows progress and completes in the Electron window', async ({ session }) => {
    const page = session.page()
    const row = page.getByRole('button', { name: /Refresh Sessions visibly/ })
    await expect(row).toBeVisible()

    const filter = page.getByRole('button', { name: 'Filter Sessions' })
    const refresh = page.getByRole('menuitem', { name: 'Refresh Sessions' })
    await filter.click()
    await expect(refresh).toBeEnabled()
    // The held sync stays running until the case has read it, however slow the machine is.
    const hold = sessionSyncHoldFile(session.root)
    await writeFile(hold, '')
    await refresh.click()
    await expect(page.getByRole('progressbar', { name: 'Session refresh progress' })).toBeVisible()
    await filter.click()
    await expect(refresh).toBeDisabled()
    await rm(hold)
    await expect(refresh).toBeEnabled()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('progressbar')).toHaveCount(0)
    await expect(page.getByText(/Syncing/)).toHaveCount(0)
    await expect(row).toBeVisible()
  })
})

test('session-list-selection', async ({ session }) => {
  await provePackagedSessionListSelection(session.page())
})

test('session-delegation-cards', async ({ session }) => {
  await proveDelegationCards(session.page())
})

test('session-subagent-feed', async ({ session }) => {
  await proveSubagentFeed(session.page())
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

test('session-live-codex-model-choices', async ({ session }) => {
  await proveLiveCodexModelChoices(session.page())
})

// The fillers are written while the app is closed: a write it watches is new activity, not old history.
test('session-list-window', async ({ session }) => {
  const { claudeTranscripts, project } = session.fixture
  await session.restart(() => writeWindowFillerSessions(claudeTranscripts, project))
  await proveSessionListWindow(session.page())
})

test.describe('with the Claude ACP agent', () => {
  test.skip(
    ({ sessionBackend }) => sessionBackend === 'real',
    'The real backend runs no ACP agent.',
  )

  test('session-claude-acp-history', async ({ session, backend }) => {
    await proveClaudeAcpHistory(session.page(), { backend, root: session.root })
  })
  test('session-claude-acp-discovery-resume', async ({ session, backend }) => {
    await proveClaudeAcpDiscovery(session.page(), {
      root: session.root,
      project: session.fixture.project,
      backend,
      restart: session.restart,
    })
  })
  test('session-claude-acp-controls', async ({ session, backend }) => {
    await proveClaudeAcpControls(session.page(), backend)
  })
})

test.describe('with no Claude ACP agent installed', () => {
  test.use({ uninstalledAcpAgents: ['claude-acp'] })

  test('session-new-uses-installed-harness', async ({ session }) => {
    test.slow(true, 'The case restarts the app twice.')
    await proveNewSessionSkipsUninstalledHarness(session.page(), session.restart)
  })
})

test.describe('with the real Claude SDK history', () => {
  test.skip(({ sessionBackend }) => sessionBackend !== 'real', 'Requires a signed-in Claude CLI.')

  test('session-sdk-history-real', async ({ session, backend }) => {
    const sessionId = await proveSessionCreatedByClick(session.page(), backend)
    const restarted = await session.restart()
    const external = await sessionDetails(restarted, sessionId)
    expect(external?.posture).toBe(null)
    await openSessionByClick(restarted, sessionId)
    await restarted.waitForSelector(`.feed__viewport[data-session="${sessionId}"] [data-feed-row]`)
    const prompt = 'Continue the external SDK history with one short acknowledgement.'
    const composer = restarted.getByRole('combobox', { name: 'Message' })
    await composer.click()
    await restarted.keyboard.type(prompt)
    await restarted.getByRole('button', { name: 'Send message' }).click()
    await backend.waitForReply(restarted, { harness: 'claude', prompt })
    const live = await sessionDetails(restarted, sessionId)
    expect(live?.posture).toBe('live')
  })
})

// Hook and lifecycle frames update a Session but draw no Feed row, for each Harness alike (#3003).
test('session-feed-hides-lifecycle-events', async ({ session, backend }) => {
  const page = session.page()
  for (const harness of ['claude', 'codex'] as const) {
    const sessionId = await proveSessionCreatedByClick(page, backend, {
      harness,
      prompt: `Reply once for the ${harness} lifecycle proof.`,
    })
    await expect
      .poll(async () => (await sessionRows(page)).find((row) => row.id === sessionId)?.status)
      .toBe('idle')
    const feed = page.locator(ACTIVE_FEED)
    await expect(feed.locator('[data-feed-row]').first()).toBeVisible()
    await expect(feed.getByText('Unsupported item')).toHaveCount(0)
    await expect(feed.getByText('Status updated')).toHaveCount(0)
  }
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
      prompt:
        'Review this pasted snippet: <pasted_content id="corpus-paste">const answer = 42</pasted_content id="corpus-paste">. Start one short Task agent in the background that returns READY. Wait for its completion notification, then acknowledge the result in one sentence.',
      budgetTurnConfiguration: true,
      permissionMode: 'auto',
    })
    const composer = session.page().getByRole('combobox', { name: 'Message' })
    await composer.click()
    await session.page().keyboard.type('!printf hello; printf warning >&2')
    await session.page().getByRole('button', { name: 'Send message' }).click()
    const codexSessionId = await proveSessionCreatedByClick(session.page(), backend, {
      harness: 'codex',
      prompt: RECORDED_PROMPTS.codexNotice,
      budgetTurnConfiguration: true,
    })
    const corpus = await readRealVendorCorpus({
      home: path.join(session.root, 'home'),
      sessionIds: { claude: claudeSessionId, codex: codexSessionId },
    })
    await assertVendorFeedCorpus(corpus)
  })
})

test('session-codex-resume', async ({ session, backend }) => {
  await provePackagedCodexResume(session.page(), { backend, restart: session.restart })
})

// The real backend links its Claude projects folder to the fixture's, so one read-back serves both.
test('session-claude-rename', async ({ session, backend }) => {
  await proveClaudeRename(session.page(), {
    backend,
    project: session.fixture.project,
    transcripts: session.fixture.claudeTranscripts,
  })
})

test.describe('session-codex-thread-name', () => {
  // The rename lands in the mock Codex store; a real Codex never reads it.
  test.skip(({ sessionBackend }) => sessionBackend !== 'mock', 'Writes the mock Codex store.')

  test('session-codex-thread-name', async ({ session }) => {
    await proveCodexThreadName(session.page(), session.root)
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

test.describe('with a Harness that holds its start', () => {
  test.use({ heldStart: true })

  for (const harness of ['claude', 'codex'] as const)
    test(`session-${harness}-prompt-before-naming`, async ({ session, backend }) => {
      await provePromptBeforeNaming(session.page(), backend, harness)
    })
})

test('shipped fuses stay intact', async () => {
  test.skip(!packagedRun, 'Only the packaged app has fuses.')
  await assertShippedFusesIntact()
})
