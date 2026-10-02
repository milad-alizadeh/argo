// The Session List dot follows each Harness's live status events, pushed without a poll (#2850).
import path from 'node:path'
import { _electron as electron, type Page } from 'playwright-core'
import { SESSION_CLAUDE_EXECUTABLE_ENV } from '@/harnesses/claude/proof-protocol'
import { SESSION_CODEX_EXECUTABLE_ENV } from '@/harnesses/codex/proof-protocol'
import type { Harness } from '@/harnesses/harness'
import {
  SESSION_MOCK_ADVERSARIAL_SEED_ENV,
  SESSION_MOCK_REPLY_DELAY_MS_ENV,
} from '@/harnesses/proof-protocol'
import { PROJECT_PROOF_STORE_ENV } from '@/platform/contract/project-proof'
import { writeMockClaude } from '../../mocks/cli/claude/mock-claude-cli'
import { writeMockCodexLive } from '../../mocks/cli/codex/mock-codex-cli'
import { signedInHarnessEnvironment } from '../../mocks/cli/signed-in-harness'
import { isolatedLaunchEnvironment } from '../../mocks/harness-home'
import { ACCEPTANCE_ENV } from '../../scripts/acceptance-protocol.mts'
import { closeApplication, launchCommand } from '../application-under-test'
import { expect, test } from '../packaged-proof'
import { prepare } from './fixtures/feed.fixture'
import {
  chooseHarness,
  openSessionByClick,
  PERSISTED_ROW,
  sendFromComposer,
  TURN_CONFIGURATION,
} from './gestures'
import { sessionDetails } from './page-trpc'

// Long enough for the Session List to re-read while the Turn still runs.
const REPLY_DELAY_MS = 3_000

type Fixture = Awaited<ReturnType<typeof prepare>>

async function launch(
  root: string,
  applicationUnderTest: string,
  environment: Record<string, string> = {},
) {
  const fixture = await prepare(root, applicationUnderTest, { projectSelected: true })
  return { fixture, ...(await open(root, fixture, environment)) }
}

// Opens the app on a prepared fixture; a second open is a restart with no live channel left.
async function open(root: string, fixture: Fixture, environment: Record<string, string> = {}) {
  const application = await electron.launch({
    ...launchCommand(fixture.application),
    env: {
      ...(await isolatedLaunchEnvironment(root)),
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

// Neither the last Model nor its lowest Effort is a default, so a restart that forgets them shows.
async function startSession(
  page: Page,
  {
    harness,
    prompt,
    configuration = 'first model',
  }: {
    harness: Harness
    prompt: string
    configuration?: 'first model' | 'last model at lowest effort'
  },
) {
  await page.getByRole('button', { name: 'New Session', exact: true }).click()
  await chooseHarness(page, harness)
  // A Harness switch keeps the previous Harness's model, so pick one this Harness offers.
  await page.locator(TURN_CONFIGURATION).click()
  const models = page.getByRole('radiogroup', { name: 'Model' }).getByRole('radio')
  if (configuration === 'first model') await models.first().press('Space')
  else {
    await models.last().press('Space')
    const effort = page.getByRole('slider', { name: 'Effort' })
    await effort.focus()
    await page.keyboard.press('Home')
  }
  await page.keyboard.press('Escape')
  const composer = page.getByRole('combobox', { name: 'Message' })
  await composer.click()
  await page.keyboard.type(prompt)
  await page.keyboard.press('Enter')
  const row = page.locator(PERSISTED_ROW).filter({ hasText: prompt })
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
      const dot = await startSession(page, {
        harness,
        prompt: `Session List status for ${harness}`,
      })
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
      await startSession(page, { harness, prompt })
      const row = page.locator(PERSISTED_ROW).filter({ hasText: prompt })
      const feed = page.getByRole('region', { name: 'Session history' })
      const toolLabel = harness === 'claude' ? 'Check the Feed' : 'rtk bun run typecheck'
      await expect(feed).toContainText(toolLabel)
      await expect(row).toContainText('Inspecting the results')
      await expect(feed).toContainText('Inspecting the results')
    } finally {
      await closeApplication(application)
    }
  })

// A Session Argo drives has no external poll, so its live Turns alone move the row's time (#3165).
for (const harness of ['claude', 'codex'] as const)
  test(`the ${harness} Session row time moves when a later Turn completes`, async ({
    root,
    applicationUnderTest,
  }) => {
    const { application, page } = await launch(root, applicationUnderTest, {
      [SESSION_MOCK_REPLY_DELAY_MS_ENV]: '500',
    })
    try {
      const prompt = `Session row time for ${harness}`
      const dot = await startSession(page, { harness, prompt })
      const row = page.locator(PERSISTED_ROW).filter({ hasText: prompt })
      const shownAt = async () =>
        Date.parse((await row.locator('time').getAttribute('datetime')) ?? '')
      await expect(dot).toHaveAttribute('data-variant', /^(idle|unread)$/, { timeout: 15_000 })
      const firstTurn = await shownAt()
      await sendFromComposer(page, 'A second Turn')
      await expect(dot).toHaveAttribute('data-variant', 'active')
      await expect(dot).toHaveAttribute('data-variant', /^(idle|unread)$/, { timeout: 15_000 })
      await expect.poll(shownAt).toBeGreaterThan(firstTurn)
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
      const dot = await startSession(page, { harness, prompt })
      await expect(dot).toHaveAttribute('data-variant', 'attention')
      await page.getByRole('button', { name: 'Allow', exact: true }).click()
      await expect(dot).toHaveAttribute('data-variant', /^(idle|unread)$/, { timeout: 15_000 })
    } finally {
      await closeApplication(application)
    }
  })

// Each mock reports a two-step Plan with one step done on a `PLAN` prompt.
for (const harness of ['claude', 'codex'] as const)
  test(`the ${harness} Session row keeps its Model, Effort, Mode and Plan step after a restart`, async ({
    root,
    applicationUnderTest,
  }) => {
    const first = await launch(root, applicationUnderTest, {
      [SESSION_MOCK_REPLY_DELAY_MS_ENV]: '0',
    })
    let sessionId: string | null
    let configuration: string | null
    let stored: unknown
    try {
      const prompt = `PLAN the row for ${harness}`
      await startSession(first.page, {
        harness,
        prompt,
        configuration: 'last model at lowest effort',
      })
      const row = first.page.locator(PERSISTED_ROW).filter({ hasText: prompt })
      sessionId = await row.getAttribute('data-session-id')
      await expect(row.locator('[data-slot="session-status"]')).toHaveAttribute(
        'data-variant',
        /^(idle|unread)$/,
        { timeout: 15_000 },
      )
      // Pushed to the row as the Feed reads the Plan, with no reload.
      await expect(row).toContainText('Step 1/2')
      configuration = await first.page.locator(TURN_CONFIGURATION).getAttribute('aria-label')
      stored = (await sessionDetails(first.page, sessionId ?? ''))?.turnConfiguration
      expect(stored).toEqual({
        model: expect.any(String),
        effort: expect.any(String),
        mode: expect.any(String),
      })
    } finally {
      await first.application.close()
    }
    const second = await open(root, first.fixture)
    try {
      if (sessionId === null) throw new Error('The started Session has no id.')
      const row = second.page.locator(`${PERSISTED_ROW}[data-session-id="${sessionId}"]`)
      await expect(row).toContainText('Step 1/2')
      // The composer can also restore from its draft, so the row's own record is read too.
      expect((await sessionDetails(second.page, sessionId))?.turnConfiguration).toEqual(stored)
      await openSessionByClick(second.page, sessionId)
      await expect(second.page.locator(TURN_CONFIGURATION)).toHaveAttribute(
        'aria-label',
        configuration ?? '',
      )
    } finally {
      await second.application.close()
    }
  })
