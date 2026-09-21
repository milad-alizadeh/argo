import assert from 'node:assert/strict'
import type { ElectronApplication, Page } from 'playwright-core'
import { test as packagedTest } from '../packaged-proof'
import { launch, prepare } from './fixtures/project.fixture'

type ProjectRun = {
  application: ElectronApplication
  page: Page
  fixture: Awaited<ReturnType<typeof prepare>>
}

const test = packagedTest.extend<{ project: ProjectRun }>({
  project: async ({ root, packagedApplication }, use) => {
    const fixture = await prepare(root, packagedApplication)
    const application = await launch(fixture)
    try {
      const page = await application.firstWindow()
      await page.waitForFunction(() => typeof window.argo?.projectSetupSnapshot === 'function')
      await use({ application, page, fixture })
    } finally {
      await application.close()
    }
  },
})

test.setTimeout(120_000)

test('delivers one revisioned setup command and restores its durable actor state', async ({
  project,
}) => {
  const first = await project.page.evaluate(() =>
    window.argo.projectSetupSnapshot({ projectId: 'project-1' }),
  )
  assert.equal(first.type, 'project.setup.snapshot')
  if (first.type !== 'project.setup.snapshot') return
  const manual = await project.page.evaluate(
    ({ expectedRevision }) =>
      window.argo.sendProjectSetupCommand({
        projectId: 'project-1',
        commandId: 'choose-manual-e2e',
        expectedRevision,
        command: { type: 'choose-manual' },
      }),
    { expectedRevision: first.revision },
  )
  assert.equal(manual.type, 'project.setup.snapshot')
  assert.equal(manual.type === 'project.setup.snapshot' && manual.screen, 'manual')
  await project.application.close()

  const restarted = await launch(project.fixture)
  try {
    const restored = await (await restarted.firstWindow()).evaluate(() =>
      window.argo.projectSetupSnapshot({ projectId: 'project-1' }),
    )
    assert.equal(restored.type, 'project.setup.snapshot')
    assert.equal(restored.type === 'project.setup.snapshot' && restored.screen, 'manual')
  } finally {
    await restarted.close()
  }
})
