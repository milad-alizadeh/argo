import assert from 'node:assert/strict'
import type { ElectronApplication, Page } from 'playwright-core'
import { launch } from '../projects/fixtures/project.fixture'
import { expect, test } from './fixtures/project-setup.fixture'

test.skip(true, 'Replaced by the Session and Project setup rewrite in #2576.')

async function hiddenPage(application: ElectronApplication): Promise<Page> {
  const page = await application.firstWindow()
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.hide())
  return page
}

async function assertSideBySide(
  left: ReturnType<Page['getByRole']>,
  right: ReturnType<Page['getByRole']>,
) {
  const [leftBox, rightBox] = await Promise.all([left.boundingBox(), right.boundingBox()])
  assert(leftBox && rightBox)
  assert(Math.abs(leftBox.y - rightBox.y) <= 2)
  assert(leftBox.x < rightBox.x)
}

async function assertPermissionLayout(page: Page) {
  const command = page.locator('pre').filter({ hasText: 'bun test' })
  const permission = page.getByText('Permission needed')
  const allow = page.getByRole('button', { name: 'Allow' })
  const [commandBox, permissionBox, allowBox] = await Promise.all([
    command.boundingBox(),
    permission.boundingBox(),
    allow.boundingBox(),
  ])
  assert(commandBox && permissionBox && allowBox)
  assert(Math.abs(commandBox.x - permissionBox.x) <= 2)
  assert(Math.abs(commandBox.x + commandBox.width - (allowBox.x + allowBox.width)) <= 2)
  await assertSideBySide(page.getByRole('button', { name: 'Deny' }), allow)
}

async function applyReviewedPlan(page: Page) {
  await page.getByRole('button', { name: 'Plan with Claude' }).click()
  await expect(page.getByRole('heading', { name: 'Review the setup plan' })).toBeVisible()
  await page.getByRole('button', { name: 'Accept plan' }).click()
}

test.describe('permission', () => {
  test.use({ projectSetupScenario: 'permission' })

  test('continues the same planning Session through permission and completes setup', async ({
    projectSetup,
  }, testInfo) => {
    const { page } = projectSetup
    await page.getByRole('button', { name: 'Plan with Claude' }).click()
    await expect(page.getByText('Permission needed')).toBeVisible()
    await assertPermissionLayout(page)
    await page.screenshot({ path: testInfo.outputPath('permission.png') })
    await page.getByRole('button', { name: 'Allow' }).click()
    await expect(page.getByRole('heading', { name: 'Review the setup plan' })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('plan-review.png') })
    await page.getByRole('button', { name: 'Accept plan' }).click()
    await expect(page.getByRole('heading', { name: 'Review the observed changes' })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('change-review.png') })
    const revise = page.getByRole('button', { name: 'Send to agent' })
    const approve = page.getByRole('button', { name: 'Approve final diff' })
    await assertSideBySide(revise, approve)
    await approve.click()
    await expect(page.getByRole('heading', { name: 'Setup ready' })).toBeVisible()
  })

  test('denies permission and continues the same planning Session', async ({ projectSetup }) => {
    const { page } = projectSetup
    await page.getByRole('button', { name: 'Plan with Claude' }).click()
    await expect(page.getByText('Permission needed')).toBeVisible()
    await page.getByRole('button', { name: 'Deny' }).click()
    await expect(page.getByRole('heading', { name: 'Review the setup plan' })).toBeVisible()
  })

  test('restores an active planning Attempt as interrupted after restart', async ({
    projectSetup,
  }) => {
    await projectSetup.page.getByRole('button', { name: 'Plan with Claude' }).click()
    await expect(projectSetup.page.getByText('Permission needed')).toBeVisible()
    await projectSetup.application.close()

    const restarted = await launch(projectSetup.fixture, projectSetup.environment)
    try {
      const page = await hiddenPage(restarted)
      await expect(
        page.getByRole('heading', { name: 'Project setup was interrupted' }),
      ).toBeVisible()
      const resume = page.getByRole('button', { name: 'Resume setup' })
      const restart = page.getByRole('button', { name: 'Start a new Attempt' })
      await assertSideBySide(resume, restart)
      await restart.click()
      await expect(page.getByRole('heading', { name: /^Choose setup for/ })).toBeVisible()
    } finally {
      await restarted.close()
    }
  })
})

test.describe('questions', () => {
  test.use({ projectSetupScenario: 'questions' })

  test('answers focused questions and reviews the revised plan', async ({ projectSetup }) => {
    const { page } = projectSetup
    await page.getByRole('button', { name: 'Plan with Claude' }).click()
    await expect(page.getByRole('heading', { name: 'Answer setup questions' })).toBeVisible()
    await page.getByRole('button', { name: 'Desktop app' }).click()
    await page.getByRole('button', { name: 'Website' }).click()
    await page.getByLabel('Other answer').fill('Keep shared packages in the repository Target.')
    await page.getByRole('button', { name: 'Continue planning' }).click()
    await expect(page.getByRole('heading', { name: 'Review the setup plan' })).toBeVisible()
  })
})

test.describe('invalid plan', () => {
  test.use({ projectSetupScenario: 'invalid' })

  test('keeps invalid output out of review and accepts revision feedback', async ({
    projectSetup,
  }) => {
    const { page } = projectSetup
    await page.getByRole('button', { name: 'Plan with Claude' }).click()
    await expect(page.getByRole('heading', { name: 'The setup plan needs revision' })).toBeVisible()
    await page.getByLabel('Plan revision feedback').fill('Return the complete plan.')
    await page.getByRole('button', { name: 'Request revision' }).click()
    await expect(page.getByRole('heading', { name: 'Review the setup plan' })).toBeVisible()
  })
})

test.describe('application failure', () => {
  test.use({ projectSetupScenario: 'application-failure' })

  test('returns a failed application to plan review', async ({ projectSetup }) => {
    const { page } = projectSetup
    await applyReviewedPlan(page)
    await expect(page.getByRole('heading', { name: 'Review the setup plan' })).toBeVisible()
  })
})

test('sends review feedback to the application agent and returns a revised diff', async ({
  projectSetup,
}) => {
  const { page } = projectSetup
  await applyReviewedPlan(page)
  await expect(page.getByRole('heading', { name: 'Review the observed changes' })).toBeVisible()
  await page.getByLabel('Message the setup agent').fill('Keep the setup file more compact.')
  await page.getByRole('button', { name: 'Send to agent' }).click()
  await expect(page.getByRole('heading', { name: 'Review the observed changes' })).toBeVisible()
})
