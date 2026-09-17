// The packaged Project contract: the preload surface, `openProject` and its refusals, each read
// off its own launch of the shipped app against its own application data (#2326).
import assert from 'node:assert/strict'
import { chmod, readFile } from 'node:fs/promises'
import type { ElectronApplication, Page } from 'playwright-core'
import { assertShippedFusesIntact } from '../packaged-app'
import { finishRecording, test as packagedTest, startRecording } from '../packaged-proof'
import { launch, prepare } from './fixtures/project.fixture'
import { PROJECT_PROOF_SURFACE } from './proof-surface'

type ProjectRun = {
  application: ElectronApplication
  page: Page
  fixture: Awaited<ReturnType<typeof prepare>>
}

const test = packagedTest.extend<{ project: ProjectRun }>({
  project: async ({ root, packagedApplication, performanceProfile }, use, testInfo) => {
    const fixture = await prepare(root, packagedApplication)
    const application = await launch(fixture)
    try {
      const traced = await startRecording(performanceProfile, application, () =>
        application.firstWindow(),
      )
      const page = await application.firstWindow()
      page.setDefaultTimeout(30_000)
      await page.waitForFunction(() => typeof window.argo?.openProject === 'function')
      await use({ application, page, fixture })
      await finishRecording(performanceProfile, traced, testInfo)
    } finally {
      await performanceProfile?.stop()
      await application.close()
    }
  },
})

const invoke = (page, value) => page.evaluate((message) => window.argo.openProject(message), value)

test('opens a registered Project through the preload surface alone', async ({ project }) => {
  const { application, page } = project
  assert.equal(await application.evaluate(({ app }) => app.isPackaged), true)
  assert.equal(
    await application.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.isVisible(),
    ),
    false,
  )
  assert.deepEqual(
    await page.evaluate(() => ({
      node: typeof window.require,
      process: typeof window.process,
      methods: Object.keys(window.argo).sort(),
    })),
    { node: 'undefined', process: 'undefined', methods: PROJECT_PROOF_SURFACE },
  )
  const reply = await invoke(page, { projectId: 'project-1' })
  assert.equal(typeof reply.requestId, 'string')
  assert.deepEqual(reply, {
    version: 1,
    type: 'project.opened',
    requestId: reply.requestId,
    project: { id: 'project-1', name: 'example' },
  })
})

test('refuses a missing Project', async ({ project }) => {
  assert.equal((await invoke(project.page, { projectId: 'missing' })).code, 'missing-project')
})

test('refuses a Project it cannot read', async ({ project }) => {
  await chmod(project.fixture.projectPath, 0)
  try {
    assert.equal((await invoke(project.page, { projectId: 'project-1' })).code, 'access-denied')
  } finally {
    await chmod(project.fixture.projectPath, 0o700)
  }
})

test('refuses a request that names a path', async ({ project }) => {
  assert.equal(
    (await invoke(project.page, { projectId: 'project-1', path: '/private' })).code,
    'invalid-request',
  )
})

test('leaves the Project store unchanged', async ({ project }) => {
  const before = await readFile(project.fixture.registryPath, 'utf8')
  await invoke(project.page, { projectId: 'project-1' })
  await invoke(project.page, { projectId: 'missing' })
  await invoke(project.page, { projectId: 'project-1', path: '/private' })
  assert.equal(await readFile(project.fixture.registryPath, 'utf8'), before)
})

test('the shipped app keeps its fuses', () => assertShippedFusesIntact())
