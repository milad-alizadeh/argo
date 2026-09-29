import path from 'node:path'
import { _electron as electron } from 'playwright-core'
import { SESSION_CODEX_EXECUTABLE_ENV } from '@/harnesses/codex/proof-protocol'
import { PROJECT_PROOF_STORE_ENV } from '@/platform/contract/project-proof'
import { writeMockCodex } from '../../mocks/cli/codex/mock-codex-cli'
import { ACCEPTANCE_ENV } from '../../scripts/acceptance-protocol.mts'
import { launchCommand } from '../application-under-test'
import { expect, test } from '../packaged-proof'
import { prepare } from './fixtures/feed.fixture'
import { chooseHarness, PERSISTED_ROW } from './gestures'

async function prepareCodexApp(root: string, applicationUnderTest: string) {
  const fixture = await prepare(root, applicationUnderTest, { projectSelected: true })
  const environment = {
    ...process.env,
    [SESSION_CODEX_EXECUTABLE_ENV]: await writeMockCodex(root),
    [PROJECT_PROOF_STORE_ENV]: fixture.userData,
    [ACCEPTANCE_ENV]: '0',
    ARGO_CODEX_E2E_STATE: path.join(root, 'codex-state.json'),
  }
  const launch = async () => {
    const application = await electron.launch({
      ...launchCommand(applicationUnderTest),
      env: environment,
    })
    const page = await application.firstWindow()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await application.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.setContentSize(1440, 860),
    )
    await page.waitForFunction(() => typeof window.argo?.trpc === 'function')
    return { application, page }
  }
  return launch
}

async function send(page: import('playwright-core').Page, prompt: string) {
  const composer = page.getByRole('combobox', { name: 'Message' })
  await composer.click()
  await page.keyboard.type(prompt)
  await page.keyboard.press('Enter')
}

test('packaged Codex live feed resumes from app-server history', async ({
  root,
  applicationUnderTest,
}) => {
  const launch = await prepareCodexApp(root, applicationUnderTest)
  const first = await launch()
  let sessionId: string
  try {
    await first.page.getByRole('button', { name: 'New Session', exact: true }).click()
    await chooseHarness(first.page, 'codex')
    await first.page.getByRole('combobox', { name: 'Message' }).fill('First Codex turn')
    await first.page.keyboard.press('Enter')
    const created = first.page.locator(PERSISTED_ROW).filter({ hasText: 'First Codex turn' })
    await expect(created).toHaveCount(1)
    sessionId = (await created.getAttribute('data-session-id')) ?? ''
    expect(sessionId).not.toMatch(/^optimistic:|^$/)
    await expect(first.page.locator(`.feed__viewport[data-session="${sessionId}"]`)).toContainText(
      'Codex replied to: First Codex turn',
    )
  } finally {
    await first.application.close()
  }
  const second = await launch()
  try {
    await second.page
      .locator(`nav[aria-label="Sessions"] button[data-session-id="${sessionId}"]`)
      .click()
    const feed = second.page.locator(`.feed__viewport[data-session="${sessionId}"]`)
    await expect(feed).toContainText('Codex replied to: First Codex turn')
    await send(second.page, 'Second Codex turn')
    await expect(feed).toContainText('Codex replied to: Second Codex turn')
    await expect(feed.getByText('Codex replied to: First Codex turn')).toHaveCount(1)
  } finally {
    await second.application.close()
  }
})

test('packaged Codex controls queue, approve, answer, interrupt, and recover', async ({
  root,
  applicationUnderTest,
}) => {
  const launch = await prepareCodexApp(root, applicationUnderTest)
  const { application, page } = await launch()
  try {
    await page.getByRole('button', { name: 'New Session', exact: true }).click()
    await chooseHarness(page, 'codex')
    await send(page, 'Need approval')
    await expect(page.getByRole('region', { name: 'Permission needed' })).toBeVisible()
    await send(page, 'Need question')
    await page.getByRole('button', { name: 'Allow', exact: true }).click()
    const history = page.getByRole('region', { name: 'Session history' })
    await expect(history).toContainText('Which color?')
    await history.getByRole('radio', { name: /Blue/ }).check()
    await history.getByRole('button', { name: 'Send answer' }).click()
    await expect(history).toContainText('Codex replied to: Need question')
    await send(page, 'Wait to interrupt')
    await expect(page.getByRole('button', { name: 'Interrupt' })).toBeVisible()
    await page.getByRole('button', { name: 'Interrupt' }).click()
    await expect(page.getByRole('button', { name: 'Interrupt' })).toBeHidden()
    await send(page, 'Fail this turn')
    await expect(history).toContainText('Fail this turn')
    await expect(history).toContainText('Stopped')
    await send(page, 'After failure')
    await expect(history).toContainText('Codex replied to: After failure')
  } finally {
    await application.close()
  }
})
