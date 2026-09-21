import assert from 'node:assert/strict'
import type { ElectronApplication, Page } from 'playwright-core'
import { expect, test } from '../packaged-proof'
import { launch, prepare } from './fixtures/project.fixture'

test.skip(true, 'Replaced by the Session and Project setup rewrite in #2576.')

async function openSetup(application: ElectronApplication): Promise<Page> {
  const page = await application.firstWindow()
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.show())
  return page
}

async function openManualSetup(page: Page) {
  await page.getByRole('button', { name: 'Save manual setup' }).click()
  return page.getByLabel('Project configuration')
}

async function withInitialSetup(
  root: string,
  packagedApplication: string,
  action: (page: Page) => Promise<void>,
) {
  const fixture = await prepare(root, packagedApplication)
  const application = await launch(fixture)
  try {
    await action(await openSetup(application))
  } finally {
    await application.close()
  }
  return fixture
}

test('saves manual Project JSON and opens the configured Project after restart', async ({
  packagedApplication,
  root,
}) => {
  const fixture = await withInitialSetup(root, packagedApplication, async (page) => {
    const configuration = await openManualSetup(page)
    await configuration.fill('{"version":1,"targets":{"desktop":{}}}')
    await page.getByRole('button', { name: 'Save manual setup' }).click()
    await expect(page.getByRole('heading', { name: 'Setup ready' })).toBeVisible()
  })

  const restarted = await launch(fixture)
  try {
    const page = await openSetup(restarted)
    await page.waitForFunction(() => typeof window.argo?.projectSetupSnapshot === 'function')
    const [setup, project] = await page.evaluate(async () =>
      Promise.all([
        window.argo.projectSetupSnapshot({ projectId: 'project-1' }),
        window.argo.openProject({ projectId: 'project-1', requestId: 'restart' }),
      ]),
    )
    assert.equal(setup.type, 'project.setup.snapshot')
    assert.equal(setup.type === 'project.setup.snapshot' && setup.screen, 'ready')
    assert.equal(project.type, 'project.opened')
  } finally {
    await restarted.close()
  }
})

test('keeps malformed manual JSON editable without marking setup ready', async ({
  packagedApplication,
  root,
}) => {
  await withInitialSetup(root, packagedApplication, async (page) => {
    const configuration = await openManualSetup(page)
    await configuration.fill('{not-json}')
    await page.getByRole('button', { name: 'Save manual setup' }).click()
    await expect(configuration).toHaveValue('{not-json}')
    assert.equal(await page.getByRole('heading', { name: 'Setup ready' }).count(), 0)
  })
})
