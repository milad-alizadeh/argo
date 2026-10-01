// A Session running outside Argo shows the status its Harness reports on the Session List, with no Refresh.
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { _electron as electron, type Page } from 'playwright-core'
import {
  SESSION_CLAUDE_EXECUTABLE_ENV,
  SESSION_CLAUDE_SYNC_FIXTURE_ENV,
} from '@/harnesses/claude/proof-protocol'
import { SESSION_CODEX_EXECUTABLE_ENV } from '@/harnesses/codex/proof-protocol'
import { installedHookPort } from '@/harnesses/host/status-hooks'
import { PROJECT_PROOF_STORE_ENV } from '@/platform/contract/project-proof'
import {
  MOCK_CLAUDE_AGENTS_ENV,
  recordedClaudeAgent,
} from '../../mocks/cli/claude/mock-claude-agents'
import { writeMockClaude } from '../../mocks/cli/claude/mock-claude-cli'
import { MOCK_CODEX_USER_CONFIG_FILE } from '../../mocks/cli/codex/fixtures/mock-codex-user-config'
import { writeMockCodexLive } from '../../mocks/cli/codex/mock-codex-cli'
import { holdCodexWriterLock } from '../../mocks/cli/codex/mock-codex-external-threads'
import { guardRealUserConfig } from '../../mocks/cli/real-user-config'
import { hookTurn, postHook } from '../../mocks/cli/status-hooks'
import { ACCEPTANCE_ENV } from '../../scripts/acceptance-protocol.mts'
import { launchCommand } from '../application-under-test'
import { expect, test } from '../packaged-proof'
import { prepare } from './fixtures/feed.fixture'
import { PERSISTED_ROW } from './gestures'

const OLDER = 'Older terminal Session'
const NEWER = 'Newer terminal Session'
const EARLIER = Date.parse('2026-09-01T09:00:00.000Z')
const LATER = Date.parse('2026-09-02T09:00:00.000Z')

type ExternalSession = { nativeId: string; title: string; activityAt: number }
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
  // Safe to repeat: a poll that has not seen the Session yet sees it on a later call.
  openTurn: (root: string, session: ExternalSession) => Promise<void>
  closeTurn: (root: string, session: ExternalSession) => Promise<void>
  stop: () => Promise<void>
}

const claudeAgents = (root: string) => path.join(root, 'claude-agents.json')
const claudeConfig = (root: string) => path.join(root, 'claude-config')

// `claude agents --json` lists the Session busy, then idle.
function claudeSource(): StatusSource {
  const answer = (root: string, session: ExternalSession, status: 'busy' | 'idle') =>
    writeFile(claudeAgents(root), JSON.stringify([recordedClaudeAgent(session.nativeId, status)]))
  return {
    harness: 'claude',
    hooksFile: (root) => path.join(claudeConfig(root), 'settings.json'),
    async seed(root, project, sessions) {
      const records = sessions.map((session) => ({
        sessionId: session.nativeId,
        summary: session.title,
        firstPrompt: session.title,
        lastModified: session.activityAt,
        cwd: project,
      }))
      return {
        CLAUDE_CONFIG_DIR: claudeConfig(root),
        [SESSION_CLAUDE_SYNC_FIXTURE_ENV]: JSON.stringify({ records, delayMs: 0 }),
        [MOCK_CLAUDE_AGENTS_ENV]: claudeAgents(root),
      }
    },
    openTurn: (root, session) => answer(root, session, 'busy'),
    closeTurn: (root, session) => answer(root, session, 'idle'),
    stop: async () => {},
  }
}

const codexHome = (root: string) => path.join(root, 'codex-home')
const codexState = (root: string) => path.join(root, 'codex-state.json')
const codexRollout = (root: string, session: ExternalSession) =>
  path.join(codexHome(root), 'sessions', `rollout-2026-09-02T09-00-00-${session.nativeId}.jsonl`)

// A Codex writer holds the thread's lock and grows its rollout; `thread/turns/list` reads the
// newest Turn from the stored thread.
function codexSource(): StatusSource {
  let release: (() => Promise<void>) | null = null
  async function writeTurn(root: string, session: ExternalSession, status: string) {
    const threads = JSON.parse(await readFile(codexState(root), 'utf8'))
    const thread = threads.find((candidate) => candidate.id === session.nativeId)
    thread.turns = [
      {
        id: 'terminal-turn',
        status,
        items: [
          {
            id: 'terminal-prompt',
            type: 'userMessage',
            content: [{ type: 'text', text: 'Keep going' }],
          },
        ],
      },
    ]
    await writeFile(codexState(root), JSON.stringify(threads))
    await appendFile(codexRollout(root, session), `${JSON.stringify({ type: 'event_msg' })}\n`)
  }
  return {
    harness: 'codex',
    hooksFile: (root) => path.join(codexHome(root), MOCK_CODEX_USER_CONFIG_FILE),
    async seed(root, project, sessions) {
      await mkdir(path.join(codexHome(root), 'sessions'), { recursive: true })
      for (const session of sessions) await writeFile(codexRollout(root, session), '')
      const threads = sessions.map((session) => ({
        id: session.nativeId,
        cwd: project,
        updatedAt: Math.floor(session.activityAt / 1000),
        name: session.title,
        path: codexRollout(root, session),
        turns: [],
      }))
      await writeFile(codexState(root), JSON.stringify(threads))
      return { CODEX_HOME: codexHome(root) }
    },
    async openTurn(root, session) {
      release ??= await holdCodexWriterLock(codexHome(root), session.nativeId)
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
      ARGO_CODEX_E2E_STATE: codexState(root),
      // Empty folders for the Harness the case does not seed. The run-wide ones name another app's
      // hook port, and a busy port stops every install.
      CLAUDE_CONFIG_DIR: path.join(root, 'unseeded-claude-config'),
      CODEX_HOME: path.join(root, 'unseeded-codex-home'),
      ...(await source.seed(root, fixture.project, sessions)),
    },
  })
  const page = await application.firstWindow()
  await page.waitForFunction(() => typeof window.argo?.trpc === 'function')
  return { application, page, older: sessions[0] as ExternalSession }
}

const rowTitled = (page: Page, title: string) =>
  page.locator(PERSISTED_ROW).filter({ hasText: title })

for (const createSource of [claudeSource, codexSource]) {
  test(`a ${createSource().harness} Session running elsewhere keeps its Session List row in place and shows its turn`, async ({
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

      // The poll runs every 2 s, and a Codex rollout first seen only records its size.
      await expect(async () => {
        await source.openTurn(root, older)
        await expect(dot).toHaveAttribute('data-variant', 'active', { timeout: 3_000 })
      }).toPass({ timeout: 20_000 })
      await expect(rows.first()).toContainText(NEWER)

      await source.closeTurn(root, older)
      await expect(dot).toHaveAttribute('data-variant', /^(idle|unread)$/, { timeout: 10_000 })
    } finally {
      await application.close()
      await source.stop()
    }
  })
}

// The port the app's installed hooks name, once the install has written it.
async function installedPort(root: string, source: StatusSource): Promise<number> {
  let port: number | null = null
  await expect(async () => {
    const config = JSON.parse(await readFile(source.hooksFile(root), 'utf8'))
    port = installedHookPort(config.hooks, source.harness)
    expect(port).not.toBeNull()
  }).toPass({ timeout: 15_000 })
  return port ?? 0
}

// What the row shows after each event of one recorded Turn, with no listing change at all.
const HOOK_VARIANTS: Record<string, string | RegExp> = {
  UserPromptSubmit: 'active',
  PermissionRequest: 'attention',
  Stop: /^(idle|unread)$/,
}

for (const createSource of [claudeSource, codexSource]) {
  test(`a ${createSource().harness} Session running elsewhere shows each status its installed hooks report`, async ({
    root,
    applicationUnderTest,
  }) => {
    const realConfigUnchanged = guardRealUserConfig()
    const source = createSource()
    const { application, page, older } = await launch(root, applicationUnderTest, source)
    try {
      const row = rowTitled(page, OLDER)
      const dot = row.locator('[data-slot="session-status"]')
      await expect(rowTitled(page, NEWER)).toHaveCount(1, { timeout: 30_000 })
      const port = await installedPort(root, source)
      for (const event of hookTurn(source.harness, 'bashTurn', older.nativeId)) {
        expect(await postHook(port, source.harness, event)).toBe(204)
        const variant = HOOK_VARIANTS[event.event]
        if (variant !== undefined) await expect(dot).toHaveAttribute('data-variant', variant)
        if (event.event === 'PreToolUse')
          await expect(row).toContainText(
            source.harness === 'claude' ? 'Run test suite' : 'touch b.txt',
          )
      }
    } finally {
      await application.close()
      await source.stop()
      realConfigUnchanged()
    }
  })
}
