// A Session run outside Argo shows its status on the Session List and its Turns in its Feed.
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { _electron as electron, type Page } from 'playwright-core'
import {
  SESSION_CLAUDE_EXECUTABLE_ENV,
  SESSION_CLAUDE_SYNC_FIXTURE_ENV,
} from '@/harnesses/claude/proof-protocol'
import { claudeSettingsFile } from '@/harnesses/claude/session/claude-status-hooks'
import { SESSION_CODEX_EXECUTABLE_ENV } from '@/harnesses/codex/proof-protocol'
import { PROJECT_PROOF_STORE_ENV } from '@/platform/contract/project-proof'
import {
  MOCK_CLAUDE_AGENTS_ENV,
  recordedClaudeAgent,
} from '../../mocks/cli/claude/mock-claude-agents'
import { writeMockClaude } from '../../mocks/cli/claude/mock-claude-cli'
import { MOCK_CODEX_USER_HOOKS_FILE } from '../../mocks/cli/codex/fixtures/mock-codex-skills-config'
import { writeMockCodexLive } from '../../mocks/cli/codex/mock-codex-cli'
import { holdCodexWriterLock } from '../../mocks/cli/codex/mock-codex-external-threads'
import { hookEvent, postHook } from '../../mocks/cli/status-hooks'
import { newFixturePath } from '../../mocks/sessions/mock-transcript-files'
import { ACCEPTANCE_ENV } from '../../scripts/acceptance-protocol.mts'
import { closeApplication, launchCommand } from '../application-under-test'
import { expect, test } from '../packaged-proof'
import { ACTIVE_FEED } from './feed-selectors'
import { prepare } from './fixtures/feed.fixture'
import { openSessionByClick, PERSISTED_ROW, sendFromComposer } from './gestures'
import { sessionRows } from './page-trpc'

const OLDER = 'Older terminal Session'
const NEWER = 'Newer terminal Session'
const TURN_PROMPT = 'Keep going'
const UNTITLED_PROMPT = 'Started in a terminal and never named'
const EARLIER = Date.parse('2026-09-01T09:00:00.000Z')
const LATER = Date.parse('2026-09-02T09:00:00.000Z')

// A Session with a null title has only its first prompt to show, and with neither, nothing.
type ExternalSession = {
  nativeId: string
  title: string | null
  prompt?: string
  activityAt: number
}
// What the stubbed CLI or app-server reports about a Session another process runs.
type StatusSource = {
  harness: 'claude' | 'codex'
  // The config file the app installs its status hooks in, under the case's throwaway folder.
  hooksFile: (root: string) => string
  // Writes the Sessions before launch and returns the environment that points Argo at them.
  seed: (
    root: string,
    project: string,
    sessions: ExternalSession[],
  ) => Promise<Record<string, string>>
  // Keeps the Session in the live listing, as the process running it does, so no tick drops it.
  holdLive: (root: string, session: ExternalSession) => Promise<void>
  // Safe to repeat: a poll that has not seen the Session yet sees it on a later call.
  openTurn: (root: string, session: ExternalSession) => Promise<void>
  closeTurn: (root: string, session: ExternalSession) => Promise<void>
  stop: () => Promise<void>
}

const claudeAgents = (root: string) => path.join(root, 'claude-agents.json')
const claudeConfig = (root: string) => path.join(root, 'claude-config')

// `claude agents --json` lists the Session busy, then idle; the transcript holds the Turn's prompt.
function claudeSource(): StatusSource {
  let cwd = ''
  const answer = (root: string, session: ExternalSession, status: 'busy' | 'idle') =>
    writeFile(claudeAgents(root), JSON.stringify([recordedClaudeAgent(session.nativeId, status)]))
  async function writeTurn(root: string, session: ExternalSession) {
    const file = await newFixturePath(
      path.join(claudeConfig(root), 'projects'),
      session.nativeId,
      cwd,
    )
    const prompt = {
      type: 'user',
      cwd,
      sessionId: session.nativeId,
      timestamp: new Date(session.activityAt).toISOString(),
      uuid: 'terminal-prompt',
      parentUuid: null,
      message: { role: 'user', content: [{ type: 'text', text: TURN_PROMPT }] },
    }
    await writeFile(file, `${JSON.stringify(prompt)}\n`)
  }
  return {
    harness: 'claude',
    hooksFile: (root) => claudeSettingsFile({ CLAUDE_CONFIG_DIR: claudeConfig(root) }, root),
    async seed(root, project, sessions) {
      cwd = project
      const records = sessions.map((session) => ({
        sessionId: session.nativeId,
        summary: session.title ?? '',
        firstPrompt: session.prompt,
        lastModified: session.activityAt,
        cwd: project,
      }))
      return {
        CLAUDE_CONFIG_DIR: claudeConfig(root),
        [SESSION_CLAUDE_SYNC_FIXTURE_ENV]: JSON.stringify({ records }),
        [MOCK_CLAUDE_AGENTS_ENV]: claudeAgents(root),
      }
    },
    // With no answer, `claude agents --json` fails, and a failed listing leaves every row as it is.
    holdLive: async () => {},
    async openTurn(root, session) {
      await writeTurn(root, session)
      await answer(root, session, 'busy')
    },
    closeTurn: (root, session) => answer(root, session, 'idle'),
    stop: async () => {},
  }
}

const codexTurn = (prompt: string, status: string) => ({
  id: 'terminal-turn',
  status,
  items: [
    { id: 'terminal-prompt', type: 'userMessage', content: [{ type: 'text', text: prompt }] },
  ],
})

const codexHome = (root: string) => path.join(root, 'codex-home')
const codexState = (root: string) => path.join(root, 'codex-state.json')
const codexRollout = (root: string, session: ExternalSession) =>
  path.join(codexHome(root), 'sessions', `rollout-2026-09-02T09-00-00-${session.nativeId}.jsonl`)

// A Codex writer holds the thread's lock and grows its rollout; `thread/turns/list` reads the
// newest Turn from the stored thread.
function codexSource(): StatusSource {
  let release: (() => Promise<void>) | null = null
  async function holdLive(root: string, session: ExternalSession) {
    release ??= await holdCodexWriterLock(codexHome(root), session.nativeId)
  }
  async function writeTurn(root: string, session: ExternalSession, status: string) {
    const threads = JSON.parse(await readFile(codexState(root), 'utf8'))
    const thread = threads.find((candidate) => candidate.id === session.nativeId)
    thread.turns = [codexTurn(TURN_PROMPT, status)]
    await writeFile(codexState(root), JSON.stringify(threads))
    await appendFile(codexRollout(root, session), `${JSON.stringify({ type: 'event_msg' })}\n`)
  }
  return {
    harness: 'codex',
    hooksFile: (root) => path.join(codexHome(root), MOCK_CODEX_USER_HOOKS_FILE),
    async seed(root, project, sessions) {
      await mkdir(path.join(codexHome(root), 'sessions'), { recursive: true })
      for (const session of sessions) await writeFile(codexRollout(root, session), '')
      // Codex types `preview` as a string and leaves it empty when it holds none.
      const threads = sessions.map((session) => ({
        id: session.nativeId,
        cwd: project,
        updatedAt: Math.floor(session.activityAt / 1000),
        parentThreadId: null,
        name: session.title,
        preview: '',
        path: codexRollout(root, session),
        turns: session.prompt === undefined ? [] : [codexTurn(session.prompt, 'completed')],
      }))
      await writeFile(codexState(root), JSON.stringify(threads))
      return { CODEX_HOME: codexHome(root), ARGO_CODEX_E2E_STATE: codexState(root) }
    },
    holdLive,
    async openTurn(root, session) {
      await holdLive(root, session)
      await writeTurn(root, session, 'inProgress')
    },
    closeTurn: (root, session) => writeTurn(root, session, 'completed'),
    async stop() {
      await release?.()
    },
  }
}

async function launch(root: string, applicationUnderTest: string, source: StatusSource) {
  const fixture = await prepare(root, applicationUnderTest, { projectSelected: true })
  const sessions = [
    { nativeId: '00000000-0000-4000-8000-00000000e001', title: OLDER, activityAt: EARLIER },
    { nativeId: '00000000-0000-4000-8000-00000000e002', title: NEWER, activityAt: LATER },
  ]
  const application = await electron.launch({
    ...launchCommand(applicationUnderTest),
    env: {
      ...process.env,
      [SESSION_CLAUDE_EXECUTABLE_ENV]: await writeMockClaude(root, fixture.claudeTranscripts),
      [SESSION_CODEX_EXECUTABLE_ENV]: await writeMockCodexLive(root),
      [PROJECT_PROOF_STORE_ENV]: fixture.userData,
      [ACCEPTANCE_ENV]: '0',
      // Empty places for the Harness the case does not seed, so it adds no rows and shares no config.
      ARGO_CODEX_E2E_STATE: path.join(root, 'unseeded-codex-state.json'),
      CLAUDE_CONFIG_DIR: path.join(root, 'unseeded-claude-config'),
      CODEX_HOME: path.join(root, 'unseeded-codex-home'),
      ...(await source.seed(root, fixture.project, sessions)),
    },
  })
  const page = await application.firstWindow()
  await page.waitForFunction(() => typeof window.argo?.trpc === 'function')
  const socketPath = path.join(fixture.userData, 'hooks.sock')
  return { application, page, older: sessions[0] as ExternalSession, socketPath }
}

const rowTitled = (page: Page, title: string) =>
  page.locator(PERSISTED_ROW).filter({ hasText: title })

for (const createSource of [claudeSource, codexSource]) {
  test(`a ${createSource().harness} Session running elsewhere keeps its Session List row in place and shows its Turn in its Feed`, async ({
    root,
    applicationUnderTest,
  }) => {
    const source = createSource()
    const { application, page, older } = await launch(root, applicationUnderTest, source)
    try {
      const rows = page.locator(PERSISTED_ROW)
      const dot = rowTitled(page, OLDER).locator('[data-slot="session-status"]')
      await expect(rowTitled(page, NEWER)).toHaveCount(1, { timeout: 30_000 })
      await expect(rows.first()).toContainText(NEWER)
      await expect(dot).toHaveAttribute('data-variant', 'unknown')

      // The poll runs every 2 s.
      await expect(async () => {
        await source.openTurn(root, older)
        await expect(dot).toHaveAttribute('data-variant', 'active', { timeout: 3_000 })
      }).toPass({ timeout: 20_000 })
      await expect(rows.first()).toContainText(NEWER)

      await source.closeTurn(root, older)
      await expect(dot).toHaveAttribute('data-variant', /^(idle|unread)$/, { timeout: 10_000 })

      await openSessionByClick(
        page,
        String(await rowTitled(page, OLDER).getAttribute('data-session-id')),
      )
      await expect(page.locator(ACTIVE_FEED)).toContainText(TURN_PROMPT)
    } finally {
      await closeApplication(application)
      await source.stop()
    }
  })
}

// Waits until the app's install has written its hooks, naming its socket.
async function hooksInstalled(root: string, source: StatusSource, socketPath: string) {
  await expect(async () => {
    expect(await readFile(source.hooksFile(root), 'utf8')).toContain(socketPath)
  }).toPass({ timeout: 15_000 })
}

for (const createSource of [claudeSource, codexSource]) {
  test(`a ${createSource().harness} Session running elsewhere shows the status its installed hooks report`, async ({
    root,
    applicationUnderTest,
  }) => {
    const source = createSource()
    const { application, page, older, socketPath } = await launch(
      root,
      applicationUnderTest,
      source,
    )
    try {
      const dot = rowTitled(page, OLDER).locator('[data-slot="session-status"]')
      await expect(rowTitled(page, NEWER)).toHaveCount(1, { timeout: 30_000 })
      await source.holdLive(root, older)
      await hooksInstalled(root, source, socketPath)
      const post = (event: string) =>
        postHook(
          socketPath,
          source.harness,
          hookEvent(source.harness, event, older.nativeId).payload,
        )
      expect(await post('PermissionRequest')).toBe(204)
      await expect(dot).toHaveAttribute('data-variant', 'attention')
      expect(await post('Stop')).toBe(204)
      await expect(dot).toHaveAttribute('data-variant', /^(idle|unread)$/)
    } finally {
      await application.close()
      await source.stop()
    }
  })
}

// Claude and Codex rows draw the same title for a Session nobody named, and never its ID (#3167).
const UNTITLED_CASES = [
  {
    title: 'shows its first prompt',
    prompt: UNTITLED_PROMPT,
    name: UNTITLED_PROMPT,
    shown: UNTITLED_PROMPT,
    sent: undefined,
  },
  {
    title: 'and no prompt shows Untitled Session until a sent prompt names it',
    prompt: undefined,
    name: null,
    shown: 'Untitled Session',
    sent: 'Prompt into untitled',
  },
] as const
for (const createSource of [claudeSource, codexSource]) {
  for (const { title, prompt, name, shown, sent } of UNTITLED_CASES) {
    test(`a ${createSource().harness} Session started elsewhere with no title ${title}`, async ({
      root,
      applicationUnderTest,
    }) => {
      const titled = createSource()
      const untitled = {
        nativeId: '00000000-0000-4000-8000-00000000e003',
        title: null,
        prompt,
        activityAt: LATER,
      }
      const source: StatusSource = {
        ...titled,
        seed: (root, project) => titled.seed(root, project, [untitled]),
      }
      const { application, page } = await launch(root, applicationUnderTest, source)
      try {
        await expect
          .poll(async () => (await sessionRows(page)).map((row) => row.name), { timeout: 30_000 })
          .toEqual([name])
        await expect(rowTitled(page, shown)).toHaveCount(1)
        const shownId = page.locator(PERSISTED_ROW).filter({ hasText: /[0-9a-f]{8}-[0-9a-f]{4}-/ })
        await expect(shownId).toHaveCount(0)
        if (sent === undefined) return
        // The row and header take the prompt as the title live, with no reload.
        const [row] = await sessionRows(page)
        if (row === undefined) throw new Error('The untitled Session row is absent.')
        await openSessionByClick(page, row.id)
        await sendFromComposer(page, sent)
        await expect(rowTitled(page, sent)).toHaveCount(1, { timeout: 10_000 })
        await expect(page.getByRole('heading', { level: 1, name: sent })).toBeVisible()
      } finally {
        await closeApplication(application)
        await source.stop()
      }
    })
  }
}
