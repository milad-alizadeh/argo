import type { ElectronApplication, Page } from 'playwright-core'
import type { MockSetupDocument } from '../../mocks/providers/setup/mock-setup-document-loopback'
import { expect, test } from '../packaged-proof'
import { launch, prepareManual, readManualSetupConfiguration } from './fixtures/project.fixture'

test.use({ setupBackend: 'remote' })

async function setupWindow(application: ElectronApplication) {
  const page = await application.firstWindow()
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.show())
  return page
}

async function loadRemotePlan(page: Page) {
  await expect(page.getByText('Retrieving the setup skill and generating a plan…')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Project setup could not start' })).toBeVisible()
  await expect(
    page
      .getByRole('main', { name: /Set up .+/ })
      .getByText('Argo could not download Project setup from GitHub.'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText('Retrieving the setup skill and generating a plan…')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Ready this Project for agents' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Project', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tools', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Commands', exact: true })).toBeVisible()
  await expect(page.getByLabel('Project configuration')).toHaveCount(0)
}

async function expectProjectOpen(page: Page) {
  await expect(page.getByRole('button', { name: 'Sessions', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'New Session' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /before starting Sessions/ })).toHaveCount(0)
}

async function dismissValidationToast(page: Page) {
  const successToast = page
    .getByRole('region', { name: 'Notifications' })
    .getByText('All Project commands passed validation.')
  await successToast.waitFor()
  await page.mouse.move(0, 0)
  await expect(successToast).toBeHidden({ timeout: 10_000 })
}

async function openRemoteSetup(
  root: string,
  packagedApplication: string,
  setupDocument: MockSetupDocument | undefined,
) {
  if (!setupDocument) throw new Error('Remote Setup document fixture is unavailable.')
  const fixture = await prepareManual(root, packagedApplication, setupDocument)
  const application = await launch(fixture)
  const page = await setupWindow(application)
  await loadRemotePlan(page)
  return { application, fixture, page }
}

test('applies the guided plan and keeps the Project ready after restart', async ({
  root,
  packagedApplication,
  setupDocument,
}) => {
  test.slow()
  const { application, fixture, page } = await openRemoteSetup(
    root,
    packagedApplication,
    setupDocument,
  )
  try {
    await page.getByRole('button', { name: 'Customize plan' }).click()
    await expect(page.getByLabel('Project configuration')).toHaveCount(0)
    await expect(page.getByRole('textbox', { name: 'Project target' })).toHaveValue('.')
    const packageManager = page.getByRole('combobox', { name: 'Package manager' })
    await expect(packageManager).toContainText('Bun')
    await packageManager.click()
    await page.getByRole('option', { name: 'npm', exact: true }).click()
    await expect(packageManager).toContainText('npm')
    await expect(page.getByRole('checkbox', { name: 'Use Storybook' })).toBeChecked()
    const browserTests = page.getByRole('checkbox', { name: 'Add Playwright journeys' })
    await expect(browserTests).not.toBeChecked()
    await page.getByText('Add Playwright journeys', { exact: true }).click()
    await expect(browserTests).toBeChecked()
    await expect(page.getByRole('textbox', { name: 'Setup command' })).toHaveValue('true')
    await expect(page.getByRole('textbox', { name: 'Run command' })).toHaveValue('true')
    await expect(page.getByRole('textbox', { name: 'Test command' })).toHaveValue('true')
    await page.getByRole('button', { name: 'Test setup' }).click()
    await dismissValidationToast(page)
    await page.getByRole('button', { name: 'Apply setup' }).click()
    await expectProjectOpen(page)
    const saved = JSON.parse(await readManualSetupConfiguration(fixture))
    expect(saved.targets.desktop).toMatchObject({ browserTests: true, packageManager: 'npm' })
    await application.close()

    const restarted = await launch(fixture)
    try {
      await expectProjectOpen(await setupWindow(restarted))
    } finally {
      await restarted.close()
    }
  } finally {
    await application.close().catch(() => undefined)
  }
})

test('keeps raw configuration in Import config and opens the tested Project', async ({
  root,
  packagedApplication,
  setupDocument,
}) => {
  test.slow()
  const { application, page } = await openRemoteSetup(root, packagedApplication, setupDocument)
  try {
    await page.getByRole('button', { name: 'Import config' }).click()
    const configuration = page.getByLabel('Project configuration')
    await expect(configuration).toContainText('"version": 1')
    await page.getByRole('button', { name: 'Back' }).click()
    await expect(configuration).toHaveCount(0)
    await page.getByRole('button', { name: 'Import config' }).click()
    const imported = JSON.parse(await page.getByLabel('Project configuration').inputValue())
    imported.targets.desktop.packageManager = 'npm'
    imported.targets.desktop.browserTests = true
    await page.getByLabel('Project configuration').fill(JSON.stringify(imported, null, 2))
    await page.getByRole('button', { name: 'Back' }).click()
    await page.getByRole('button', { name: 'Customize plan' }).click()
    await expect(page.getByRole('combobox', { name: 'Package manager' })).toContainText('npm')
    await expect(page.getByRole('checkbox', { name: 'Add Playwright journeys' })).toBeChecked()
    await page.getByRole('button', { name: 'Back' }).click()
    await page.getByRole('button', { name: 'Import config' }).click()
    await page.getByRole('button', { name: 'Test configuration' }).click()
    await dismissValidationToast(page)
    await page.getByRole('button', { name: 'Save' }).click()
    await expectProjectOpen(page)
  } finally {
    await application.close().catch(() => undefined)
  }
})
