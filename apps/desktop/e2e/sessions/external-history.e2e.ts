// A Session running outside Argo moves on the roster when its history file grows, with no Refresh.
import { appendFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { _electron as electron, type Page } from 'playwright-core'
import {
  SESSION_CLAUDE_EXECUTABLE_ENV,
  SESSION_CLAUDE_SYNC_FIXTURE_ENV,
} from '@/harnesses/claude/proof-protocol'
import { SESSION_CODEX_EXECUTABLE_ENV } from '@/harnesses/codex/proof-protocol'
import { PROJECT_PROOF_STORE_ENV } from '@/platform/contract/project-proof'
import { writeMockClaude } from '../../mocks/cli/claude/mock-claude-cli'
import { writeMockCodexLive } from '../../mocks/cli/codex/mock-codex-cli'
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
type HistoryWriter = {
  harness: 'claude' | 'codex'
  // Writes the Sessions before launch and returns the environment that points Argo at them.
  seed: (
    root: string,
    project: string,
    sessions: ExternalSession[],
  ) => Promise<Record<string, string>>
  openTurn: (root: string, session: ExternalSession) => Promise<void>
  closeTurn: (root: string, session: ExternalSession) => Promise<void>
}

const claudeProjects = (root: string) => path.join(root, 'claude-config', 'projects', 'terminal')
const claudeFile = (root: string, session: ExternalSession) =>
  path.join(claudeProjects(root), `${session.nativeId}.jsonl`)

const claude: HistoryWriter = {
  harness: 'claude',
  async seed(root, project, sessions) {
    await mkdir(claudeProjects(root), { recursive: true })
    for (const session of sessions) await writeFile(claudeFile(root, session), '')
    const records = sessions.map((session) => ({
      sessionId: session.nativeId,
      summary: session.title,
      firstPrompt: session.title,
      lastModified: session.activityAt,
      cwd: project,
    }))
    return {
      CLAUDE_CONFIG_DIR: path.join(root, 'claude-config'),
      [SESSION_CLAUDE_SYNC_FIXTURE_ENV]: JSON.stringify({ records, delayMs: 0 }),
    }
  },
  openTurn: (root, session) =>
    appendFile(
      claudeFile(root, session),
      `${JSON.stringify({ type: 'user', uuid: 'terminal-prompt', parentUuid: null, message: { role: 'user', content: 'Keep going' } })}\n`,
    ),
  closeTurn: (root, session) =>
    appendFile(
      claudeFile(root, session),
      `${JSON.stringify({ type: 'assistant', uuid: 'terminal-answer', parentUuid: 'terminal-prompt', message: { role: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text: 'Done.' }] } })}\n`,
    ),
}

const codexFile = (root: string, session: ExternalSession) =>
  path.join(
    root,
    'codex-home',
    'sessions',
    '2026',
    '09',
    '02',
    `rollout-2026-09-02T09-00-00-${session.nativeId}.jsonl`,
  )

const codex: HistoryWriter = {
  harness: 'codex',
  async seed(root, project, sessions) {
    await mkdir(path.dirname(codexFile(root, sessions[0] as ExternalSession)), { recursive: true })
    for (const session of sessions) await writeFile(codexFile(root, session), '')
    const threads = sessions.map((session) => ({
      id: session.nativeId,
      cwd: project,
      updatedAt: Math.floor(session.activityAt / 1000),
      name: session.title,
      turns: [],
    }))
    const state = path.join(root, 'codex-state.json')
    await writeFile(state, JSON.stringify(threads))
    return { CODEX_HOME: path.join(root, 'codex-home'), ARGO_CODEX_E2E_STATE: state }
  },
  openTurn: (root, session) =>
    appendFile(
      codexFile(root, session),
      `${JSON.stringify({ type: 'event_msg', payload: { type: 'task_started', turn_id: 'terminal-turn' } })}\n`,
    ),
  closeTurn: (root, session) =>
    appendFile(
      codexFile(root, session),
      `${JSON.stringify({ type: 'event_msg', payload: { type: 'task_complete', turn_id: 'terminal-turn' } })}\n`,
    ),
}

async function launch(root: string, applicationUnderTest: string, writer: HistoryWriter) {
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
      ARGO_CODEX_E2E_STATE: path.join(root, 'codex-state.json'),
      ...(await writer.seed(root, fixture.project, sessions)),
    },
  })
  const page = await application.firstWindow()
  await page.waitForFunction(() => typeof window.argo?.trpc === 'function')
  return { application, page, older: sessions[0] as ExternalSession }
}

const rowTitled = (page: Page, title: string) =>
  page.locator(PERSISTED_ROW).filter({ hasText: title })

for (const writer of [claude, codex])
  test(`a ${writer.harness} history write keeps its roster row in place and shows its turn`, async ({
    root,
    applicationUnderTest,
  }) => {
    const { application, page, older } = await launch(root, applicationUnderTest, writer)
    try {
      const rows = page.locator(PERSISTED_ROW)
      const olderRow = rowTitled(page, OLDER)
      const dot = olderRow.locator('[data-slot="session-status"]')
      await expect(rowTitled(page, NEWER)).toHaveCount(1, { timeout: 30_000 })
      await expect(rows.first()).toContainText(NEWER)
      await expect(dot).toHaveAttribute('data-variant', 'unknown')

      await writer.openTurn(root, older)
      await expect(dot).toHaveAttribute('data-variant', 'active', { timeout: 10_000 })
      await expect(rows.first()).toContainText(NEWER)

      await writer.closeTurn(root, older)
      await expect(dot).toHaveAttribute('data-variant', /^(idle|unread)$/, { timeout: 10_000 })
    } finally {
      await application.close()
    }
  })

const codexMarker = (type: string, turnId: string) =>
  `${JSON.stringify({ type: 'event_msg', payload: { type, turn_id: turnId } })}\n`

// Codex aborts a replaced turn after the next one starts: that late close must not end the newer
// turn, whether the Session's Feed is open, another Session is, or more history lands.
test('a watched codex Session stays running past a stale close and idles on its own', async ({
  root,
  applicationUnderTest,
}) => {
  const { application, page, older } = await launch(root, applicationUnderTest, codex)
  try {
    const file = codexFile(root, older)
    const olderRow = rowTitled(page, OLDER)
    const dot = olderRow.locator('[data-slot="session-status"]')
    await expect(olderRow).toHaveCount(1, { timeout: 30_000 })

    await appendFile(file, codexMarker('task_started', 'replaced-turn'))
    await expect(dot).toHaveAttribute('data-variant', 'active', { timeout: 10_000 })
    await olderRow.click()
    await expect(page.getByRole('region', { name: 'Session Feed' })).toBeVisible()

    await appendFile(file, codexMarker('task_started', 'current-turn'))
    await appendFile(file, codexMarker('turn_aborted', 'replaced-turn'))
    // An absence needs a wait: this one outlasts the watcher's 250 ms settle several times over.
    await page.waitForTimeout(1_000)
    await expect(dot).toHaveAttribute('data-variant', 'active')

    await rowTitled(page, NEWER).click()
    await appendFile(file, codexMarker('token_count', 'current-turn'))
    await page.waitForTimeout(1_000)
    await expect(dot).toHaveAttribute('data-variant', 'active')
    await olderRow.click()
    await expect(dot).toHaveAttribute('data-variant', 'active')

    await appendFile(file, codexMarker('task_complete', 'current-turn'))
    await expect(dot).toHaveAttribute('data-variant', /^(idle|unread)$/, { timeout: 10_000 })
    await expect(page.getByRole('region', { name: 'Session Feed' })).toBeVisible()
  } finally {
    await application.close()
  }
})
