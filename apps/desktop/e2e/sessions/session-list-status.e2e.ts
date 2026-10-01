// The Session List dot follows each Harness's live status events, pushed without a poll (#2850).
import path from 'node:path'
import { _electron as electron, type Page } from 'playwright-core'
import type { SessionHarness } from '@/domains/sessions/renderer/harness/harnesses'
import { SESSION_CLAUDE_EXECUTABLE_ENV } from '@/harnesses/claude/proof-protocol'
import { SESSION_CODEX_EXECUTABLE_ENV } from '@/harnesses/codex/proof-protocol'
import {
  SESSION_MOCK_ADVERSARIAL_SEED_ENV,
  SESSION_MOCK_REPLY_DELAY_MS_ENV,
} from '@/harnesses/proof-protocol'
import { PROJECT_PROOF_STORE_ENV } from '@/platform/contract/project-proof'
import { writeMockClaude } from '../../mocks/cli/claude/mock-claude-cli'
import { writeMockCodexLive } from '../../mocks/cli/codex/mock-codex-cli'
import { signedInHarnessEnvironment } from '../../mocks/cli/signed-in-harness'
import { ACCEPTANCE_ENV } from '../../scripts/acceptance-protocol.mts'
import { closeApplication, launchCommand } from '../application-under-test'
import { expect, test } from '../packaged-proof'
import { prepare } from './fixtures/feed.fixture'
import { chooseHarness, PERSISTED_ROW, TURN_CONFIGURATION } from './gestures'

// Long enough for the Session List to re-read while the Turn still runs.
const REPLY_DELAY_MS = 3_000

async function launch(
  root: string,
  applicationUnderTest: string,
  environment: Record<string, string> = {},
) {
  const fixture = await prepare(root, applicationUnderTest, { projectSelected: true })
  const application = await electron.launch({
    ...launchCommand(applicationUnderTest),
    env: {
      ...process.env,
      ...(await signedInHarnessEnvironment(root)),
      [SESSION_CLAUDE_EXECUTABLE_ENV]: await writeMockClaude(root, fixture.claudeTranscripts),
      CLAUDE_CONFIG_DIR: path.dirname(fixture.claudeTranscripts),
      CODEX_HOME: path.dirname(fixture.codexTranscripts),
      [SESSION_CODEX_EXECUTABLE_ENV]: await writeMockCodexLive(root),
      [SESSION_MOCK_REPLY_DELAY_MS_ENV]: String(REPLY_DELAY_MS),
      [PROJECT_PROOF_STORE_ENV]: fixture.userData,
      [ACCEPTANCE_ENV]: '0',
      ARGO_CODEX_E2E_STATE: path.join(root, 'codex-state.json'),
      ...environment,
    },
  })
  const page = await application.firstWindow()
  await page.waitForFunction(() => typeof window.argo?.trpc === 'function')
  return { application, page }
}

async function startSession(page: Page, harness: SessionHarness, prompt: string) {
  await page.getByRole('button', { name: 'New Session', exact: true }).click()
  await chooseHarness(page, harness)
  // A Harness switch keeps the previous Harness's model, so pick one this Harness offers.
  await page.locator(TURN_CONFIGURATION).click()
  await page.getByRole('radiogroup', { name: 'Model' }).getByRole('radio').first().press('Space')
  await page.keyboard.press('Escape')
  const composer = page.getByRole('combobox', { name: 'Message' })
  await composer.click()
  await page.keyboard.type(prompt)
  await page.keyboard.press('Enter')
  const row = page.locator(PERSISTED_ROW).first()
  await expect(row).toHaveCount(1)
  return row.locator('[data-slot="session-status"]')
}

for (const harness of ['claude', 'codex'] as const)
  test(`the ${harness} Session List dot is active while a Turn runs, then idle`, async ({
    root,
    applicationUnderTest,
  }) => {
    const { application, page } = await launch(root, applicationUnderTest)
    try {
      const dot = await startSession(page, harness, `Session List status for ${harness}`)
      await expect(dot).toHaveAttribute('data-variant', 'active')
      await expect(dot).toHaveAttribute('data-variant', /^(idle|unread)$/, { timeout: 15_000 })
    } finally {
      await closeApplication(application)
    }
  })

for (const harness of ['claude', 'codex'] as const)
  test(`the ${harness} Session List and Feed show the newest activity`, async ({
    root,
    applicationUnderTest,
  }) => {
    const { application, page } = await launch(root, applicationUnderTest, {
      [SESSION_MOCK_REPLY_DELAY_MS_ENV]: '6000',
    })
    try {
      const prompt = `FeedActivityProbe ${harness}`
      await startSession(page, harness, prompt)
      const row = page.locator(PERSISTED_ROW).first()
      const feed = page.getByRole('region', { name: 'Session history' })
      const toolLabel = harness === 'claude' ? 'Check the Feed' : 'rtk bun run typecheck'
      await expect(feed).toContainText(toolLabel)
      await expect(row).toContainText('Inspecting the results')
      await expect(feed).toContainText('Inspecting the results')
    } finally {
      await closeApplication(application)
    }
  })

// Each mock asks for a permission on its first Turn: Codex on this prompt, Claude under this seed.
const PERMISSION_TURNS = {
  claude: {
    prompt: 'Session List permission for claude',
    environment: { [SESSION_MOCK_ADVERSARIAL_SEED_ENV]: 'ask' },
  },
  codex: { prompt: 'Need approval', environment: {} },
} as const

for (const harness of ['claude', 'codex'] as const)
  test(`the ${harness} Session List dot asks for attention while a permission waits`, async ({
    root,
    applicationUnderTest,
  }) => {
    const { prompt, environment } = PERMISSION_TURNS[harness]
    const { application, page } = await launch(root, applicationUnderTest, environment)
    try {
      const dot = await startSession(page, harness, prompt)
      await expect(dot).toHaveAttribute('data-variant', 'attention')
      await page.getByRole('button', { name: 'Allow', exact: true }).click()
      await expect(dot).toHaveAttribute('data-variant', /^(idle|unread)$/, { timeout: 15_000 })
    } finally {
      await closeApplication(application)
    }
  })
