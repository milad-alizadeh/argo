// The packaged Project contract: the preload surface, `openProject` and its refusals, read off one
// launch of the shipped app against its own application data.
import assert from 'node:assert/strict'
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from '@playwright/test'
import { type ElectronApplication, _electron as electron, type Page } from 'playwright-core'
import { ACCEPTANCE_ENV } from '../../scripts/acceptance-protocol.mjs'
import { PROJECT_PROOF_STORE_ENV } from '../../src/core/projects/proof-protocol'
import { appExecutable, assertShippedFusesIntact, packagedTestCopy } from '../packaged-app'
import { describePackagedProof } from '../packaged-proof'
import { PROJECT_PROOF_SURFACE } from './proof-surface'

async function prepare(root: string) {
  const application = await packagedTestCopy(root)
  const userData = path.join(root, 'userData')
  const projectPath = path.join(userData, 'example')
  await mkdir(path.join(userData, 'portable-v1'), { recursive: true })
  await mkdir(projectPath)
  const registryPath = path.join(userData, 'portable-v1', 'projects.json')
  await writeFile(
    registryPath,
    JSON.stringify({
      version: 1,
      projects: [
        { id: 'project-1', path: projectPath, bindings: [{ token: 'must-stay-private' }] },
      ],
    }),
  )
  return { application, userData, projectPath, registryPath }
}

const invoke = (page, value) => page.evaluate((message) => window.argo.openProject(message), value)

async function proveOpensProject(application, page) {
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
}

describePackagedProof(test, 'project contract', (proof) => {
  let fixture: Awaited<ReturnType<typeof prepare>>
  let registryBefore: string
  let application: ElectronApplication | undefined
  let page: Page

  proof.setup(async () => {
    fixture = await prepare(proof.root)
    registryBefore = await readFile(fixture.registryPath, 'utf8')
    application = await electron.launch({
      executablePath: appExecutable(fixture.application),
      env: { ...process.env, [PROJECT_PROOF_STORE_ENV]: fixture.userData, [ACCEPTANCE_ENV]: '0' },
      timeout: 30_000,
    })
    await proof.trace(application)
    page = await application.firstWindow()
    page.setDefaultTimeout(30_000)
    await page.waitForFunction(() => typeof window.argo?.openProject === 'function')
  })

  proof.teardown(async () => {
    await application?.close()
  })

  test('opens a registered Project through the preload surface alone', async () => {
    await proveOpensProject(application, page)
  })

  test('refuses a missing Project', async () => {
    assert.equal((await invoke(page, { projectId: 'missing' })).code, 'missing-project')
  })

  test('refuses a Project it cannot read', async () => {
    await chmod(fixture.projectPath, 0)
    try {
      assert.equal((await invoke(page, { projectId: 'project-1' })).code, 'access-denied')
    } finally {
      await chmod(fixture.projectPath, 0o700)
    }
  })

  test('refuses a request that names a path', async () => {
    assert.equal(
      (await invoke(page, { projectId: 'project-1', path: '/private' })).code,
      'invalid-request',
    )
  })

  test('leaves the Project store unchanged', async () => {
    assert.equal(await readFile(fixture.registryPath, 'utf8'), registryBefore)
  })

  test('the shipped app keeps its fuses', () => assertShippedFusesIntact())
})
