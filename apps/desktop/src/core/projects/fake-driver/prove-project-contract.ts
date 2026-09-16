import assert from 'node:assert/strict'
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron } from 'playwright-core'
import { ACCEPTANCE_ENV } from '../../../../scripts/acceptance-protocol.mjs'
import {
  type CaseResults,
  createCaseRunner,
  printPackagedProofResult,
} from '../../desktop-proof/packaged-case-runner'
import {
  appExecutable,
  assertShippedFusesIntact,
  packagedTestCopy,
} from '../../desktop-proof/packaged-test-copy'
import { PROJECT_PROOF_STORE_ENV } from './project-proof-protocol'
import { PROJECT_PROOF_SURFACE } from './project-proof-surface'

async function prepare(root) {
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

async function proveSuccess(application, page) {
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

async function proveMissingProject(page) {
  assert.equal((await invoke(page, { projectId: 'missing' })).code, 'missing-project')
}

async function proveDeniedAccess(page, fixture) {
  await chmod(fixture.projectPath, 0)
  try {
    assert.equal((await invoke(page, { projectId: 'project-1' })).code, 'access-denied')
  } finally {
    await chmod(fixture.projectPath, 0o700)
  }
}

async function proveInvalidRequest(page) {
  assert.equal(
    (await invoke(page, { projectId: 'project-1', path: '/private' })).code,
    'invalid-request',
  )
}

const root = await mkdtemp(path.join(os.tmpdir(), 'argo-packaged-project-'))
let application: Awaited<ReturnType<typeof electron.launch>> | undefined
try {
  const fixture = await prepare(root)
  const before = await readFile(fixture.registryPath, 'utf8')
  application = await electron.launch({
    executablePath: appExecutable(fixture.application),
    env: { ...process.env, [PROJECT_PROOF_STORE_ENV]: fixture.userData, [ACCEPTANCE_ENV]: '0' },
    timeout: 30_000,
  })
  const page = await application.firstWindow()
  page.setDefaultTimeout(30_000)
  await page.waitForFunction(() => typeof window.argo?.openProject === 'function')

  const results: CaseResults = { cases: [], timings: {} }
  const ran = createCaseRunner(results)
  await ran(['success'], () => proveSuccess(application, page))
  await ran(['missing-project'], () => proveMissingProject(page))
  await ran(['denied-access'], () => proveDeniedAccess(page, fixture))
  await ran(['invalid-request'], () => proveInvalidRequest(page))
  await ran(['unchanged-store'], async () => {
    assert.equal(await readFile(fixture.registryPath, 'utf8'), before)
  })

  await assertShippedFusesIntact()
  printPackagedProofResult(results.cases)
} finally {
  try {
    if (application) await application.close()
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}
