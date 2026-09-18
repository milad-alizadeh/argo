import { expect, test } from '../packaged-proof'
import { LOCALLY_READY_CONFIGURATION } from './fixtures/locally-ready-project'
import { launch, prepareManual } from './fixtures/project.fixture'

test.use({ setupBackend: 'remote' })

test('creates, validates, and reopens a locally ready Project through visible controls', async ({
  root,
  packagedApplication,
  setupDocument,
}) => {
  if (!setupDocument) throw new Error('Remote Setup document fixture is unavailable.')
  const fixture = await prepareManual(root, packagedApplication, setupDocument)
  const application = await launch(fixture)
  try {
    const page = await application.firstWindow()
    await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.show())
    await expect(page.getByRole('heading', { name: 'Remote setup proof' })).toBeVisible()
    await page.getByRole('button', { name: 'Customize plan' }).click()
    await expect(page.getByRole('textbox', { name: 'Remote working path' })).toHaveValue('.')
    const configuration = page.getByLabel('Project configuration')
    await expect(configuration).toContainText('"version": 1')
    await configuration.fill(LOCALLY_READY_CONFIGURATION)
    await page.getByRole('button', { name: 'Test config' }).click()
    await page
      .getByRole('region', { name: 'Notifications' })
      .getByText('All Project commands passed validation.')
      .waitFor()
    await page.getByRole('button', { name: 'Save config' }).click()
    await page.getByRole('region', { name: 'Notifications' }).getByText('Config saved.').waitFor()
    await application.close()

    const restarted = await launch(fixture)
    try {
      await restarted.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.show())
      const restartedPage = await restarted.firstWindow()
      await expect(restartedPage.getByLabel('Project configuration')).not.toBeVisible()
    } finally {
      await restarted.close()
    }
  } finally {
    await application.close().catch(() => undefined)
  }
})
