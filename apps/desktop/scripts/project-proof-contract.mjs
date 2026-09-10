// The version 1 opening contract, asserted inside the packaged app (#1825). Every case here was
// accepted before this slice and still holds: version 1 gains actions and never changes a message
// it already defines.
import assert from 'node:assert/strict'
import { chmod } from 'node:fs/promises'

const request = { version: 1, type: 'project.open', requestId: 'open-1', projectId: 'project-1' }

const SURFACE = [
  'getAppearance',
  'listProjects',
  'onAppearanceChanged',
  'onCommand',
  'openProject',
  'registerProject',
  'relocateProject',
  'setAppearance',
  'versions',
]

export async function proveSurface(application, page) {
  assert.equal(await application.evaluate(({ app }) => app.isPackaged), true)
  assert.equal(
    await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()),
    false,
  )
  assert.deepEqual(
    await page.evaluate(() => ({
      node: typeof window.require,
      process: typeof window.process,
      methods: Object.keys(window.argo).sort(),
    })),
    { node: 'undefined', process: 'undefined', methods: SURFACE },
  )
}

const invoke = (page, value) => page.evaluate((message) => window.argo.openProject(message), value)

export async function proveOpening(page, fixture) {
  assert.deepEqual(await invoke(page, request), {
    version: 1,
    type: 'project.opened',
    requestId: 'open-1',
    project: { id: 'project-1', name: 'example' },
  })
  assert.equal((await invoke(page, { ...request, projectId: 'missing' })).code, 'missing-project')
  await chmod(fixture.projectPath, 0)
  try {
    assert.equal((await invoke(page, request)).code, 'access-denied')
  } finally {
    await chmod(fixture.projectPath, 0o700)
  }
  assert.equal((await invoke(page, { ...request, path: '/private' })).code, 'invalid-request')
}

// The last case of the run: it leaves the window on a document that is not the cockpit.
export async function proveUntrustedDocument(application, page) {
  await application.evaluate(async ({ BrowserWindow }) => {
    await BrowserWindow.getAllWindows()[0].loadURL('data:text/html,<h1>Untrusted page</h1>')
  })
  await page.waitForFunction(() => typeof window.argo?.openProject === 'function')
  assert.equal((await invoke(page, request)).code, 'access-denied')
  assert.equal(
    (
      await page.evaluate(() =>
        window.argo.listProjects({ version: 1, type: 'project.list', requestId: 'l' }),
      )
    ).code,
    'access-denied',
  )
}
