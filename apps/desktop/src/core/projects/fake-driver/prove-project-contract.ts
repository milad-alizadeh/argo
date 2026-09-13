import assert from 'node:assert/strict'
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron } from 'playwright-core'
import { ACCEPTANCE_ENV } from '../../../../scripts/acceptance-protocol.mjs'
import {
  appExecutable,
  assertShippedFusesIntact,
  packagedTestCopy,
} from '../../desktop-proof/packaged-test-copy'
import { projectErrorSchema } from '../contract'
import { PROJECT_PROOF_STORE_ENV } from './project-proof-protocol'
import { serveUntrustedPage } from './serve-untrusted-page'

const request = { version: 1, type: 'project.open', requestId: 'open-1', projectId: 'project-1' }
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

const SURFACE = [
  'decideClaudePermission',
  'getAppearance',
  'interruptClaudeSession',
  'listProjects',
  'listSessions',
  'onAppearanceChanged',
  'onCommand',
  'openProject',
  'readClaudePermission',
  'readSessionFeed',
  'registerProject',
  'relocateProject',
  'sendClaudeSession',
  'setAppearance',
  'startClaudeSession',
  'versions',
  'zoomFactor',
]

async function proveSurface(application, page) {
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

async function prove(application, fixture) {
  const page = await application.firstWindow()
  page.setDefaultTimeout(30_000)
  await page.waitForFunction(() => typeof window.argo?.openProject === 'function')
  await proveSurface(application, page)
  const invoke = (value) => page.evaluate((message) => window.argo.openProject(message), value)
  assert.equal((await invoke({ ...request, path: '/private' })).code, 'invalid-request')
  assert.deepEqual(await invoke(request), {
    version: 1,
    type: 'project.opened',
    requestId: 'open-1',
    project: { id: 'project-1', name: 'example' },
  })
  assert.equal((await invoke({ ...request, projectId: 'missing' })).code, 'missing-project')
  await chmod(fixture.projectPath, 0)
  try {
    assert.equal((await invoke(request)).code, 'access-denied')
  } finally {
    await chmod(fixture.projectPath, 0o700)
  }
  assert.equal((await invoke({ ...request, path: '/private' })).code, 'invalid-request')
  const untrustedPage = await serveUntrustedPage(request)
  try {
    await application.evaluate(async ({ BrowserWindow }, url) => {
      const contents = BrowserWindow.getAllWindows()[0].webContents
      contents.removeAllListeners('will-navigate')
      await contents.loadURL(url)
    }, untrustedPage.url)
    assert.equal(projectErrorSchema.parse(await untrustedPage.received).code, 'access-denied')
  } finally {
    await new Promise<void>((resolve, reject) =>
      untrustedPage.server.close((error) => (error ? reject(error) : resolve())),
    )
  }
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
  await prove(application, fixture)
  assert.equal(await readFile(fixture.registryPath, 'utf8'), before)
  await assertShippedFusesIntact()
  console.log(
    JSON.stringify({
      ok: true,
      packaged: true,
      signed: false,
      profile: 'test',
      cases: [
        'success',
        'missing-project',
        'denied-access',
        'invalid-request',
        'renderer-authority',
        'untrusted-page',
        'unchanged-store',
      ],
    }),
  )
} finally {
  try {
    if (application) await application.close()
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}
