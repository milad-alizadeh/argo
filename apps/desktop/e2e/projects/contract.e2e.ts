// The packaged Project contract: the preload surface, `openProject` and its refusals, each read
// off its own launch of the shipped app against its own application data (#2326).
import assert from 'node:assert/strict'
import { chmod, readFile } from 'node:fs/promises'
import type { ElectronApplication, Page } from 'playwright-core'
import { assertShippedFusesIntact } from '../packaged-app'
import { packagedFixture } from '../packaged-fixture'
import { test as packagedTest } from '../packaged-proof'
import { launch, prepare } from './fixtures/project.fixture'
import { PROJECT_PROOF_SURFACE } from './proof-surface'

type ProjectRun = {
  application: ElectronApplication
  page: Page
  fixture: Awaited<ReturnType<typeof prepare>>
}

const test = packagedTest.extend<{ project: ProjectRun }>({
  project: packagedFixture(prepare, launch, (page) =>
    page.waitForFunction(() => typeof window.argo?.openProject === 'function'),
  ),
})

const invoke = (page, value) => page.evaluate((message) => window.argo.openProject(message), value)

async function chooseFolder(application: ElectronApplication, folder: string) {
  await application.evaluate(({ dialog }, chosen) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [chosen] })
  }, folder)
}

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
  const before = await readFile(project.fixture.databasePath)
  await invoke(project.page, { projectId: 'project-1' })
  await invoke(project.page, { projectId: 'missing' })
  await invoke(project.page, { projectId: 'project-1', path: '/private' })
  assert.deepEqual(await readFile(project.fixture.databasePath), before)
})

test('registers, restarts, selects, and reopens a Project from SQLite', async ({ project }) => {
  await chooseFolder(project.application, project.fixture.beta)
  const registered = await project.page.evaluate(() => window.argo.registerProject())
  assert.equal(registered.type, 'project.listed')
  assert.equal(registered.selectedId === 'project-1', false)
  await project.application.close()

  const restarted = await launch(project.fixture)
  try {
    const page = await restarted.firstWindow()
    const listed = await page.evaluate(() => window.argo.listProjects())
    assert.equal(listed.type, 'project.listed')
    assert.equal(listed.selectedId, registered.selectedId)
    const reopenedRegistered = await invoke(page, { projectId: registered.selectedId })
    assert.equal(reopenedRegistered.type, 'project.opened')
    const selected = await page.evaluate(() =>
      window.argo.selectProject({ projectId: 'project-1' }),
    )
    assert.equal(selected.type, 'project.listed')
  } finally {
    await restarted.close()
  }

  const reopened = await launch(project.fixture)
  try {
    const page = await reopened.firstWindow()
    const result = await invoke(page, { projectId: 'project-1' })
    assert.equal(result.type, 'project.opened')
    assert.deepEqual(result.type === 'project.opened' ? result.project : null, {
      id: 'project-1',
      name: 'example',
    })
  } finally {
    await reopened.close()
  }
})

test('the shipped app keeps its fuses', () => assertShippedFusesIntact())
