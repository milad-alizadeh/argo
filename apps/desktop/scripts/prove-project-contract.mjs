import assert from 'node:assert/strict'
import { chmod, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { FuseV1Options, FuseVersion, flipFuses } from '@electron/fuses'
import { _electron as electron } from 'playwright-core'
import { ACCEPTANCE_ENV } from './acceptance-protocol.mjs'
import { PRODUCTION_FUSE_PROFILE, readFuseWire } from './fuse-profile.mjs'
import { packagedApp } from './packaged-app.mjs'
import { PROJECT_PROOF_STORE_ENV } from './project-proof-protocol.mjs'

const request = { version: 1, type: 'project.open', requestId: 'open-1', projectId: 'project-1' }

async function prepare(root) {
  const application = path.join(root, 'Argo.app')
  await cp(packagedApp('arm64'), application, { recursive: true })
  await flipFuses(application, {
    version: FuseVersion.V1,
    ...PRODUCTION_FUSE_PROFILE,
    [FuseV1Options.EnableNodeCliInspectArguments]: true,
    resetAdHocDarwinSignature: true,
    strictlyRequireAllFuses: true,
  })
  const changedFuses = (await readFuseWire(application)).filter((fuse) => !fuse.matches)
  assert.deepEqual(
    changedFuses.map((fuse) => fuse.fuse),
    ['EnableNodeCliInspectArguments'],
  )
  const userData = path.join(root, 'userData')
  const projectPath = path.join(root, 'example')
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

async function prove(application, fixture) {
  const page = await application.firstWindow()
  page.setDefaultTimeout(30_000)
  await page.waitForFunction(() => typeof window.argo?.openProject === 'function')
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
    { node: 'undefined', process: 'undefined', methods: ['openProject', 'versions'] },
  )
  const invoke = (value) => page.evaluate((message) => window.argo.openProject(message), value)
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
  await application.evaluate(async ({ BrowserWindow }) => {
    await BrowserWindow.getAllWindows()[0].loadURL('data:text/html,<h1>Untrusted page</h1>')
  })
  await page.waitForFunction(() => typeof window.argo?.openProject === 'function')
  assert.equal((await invoke(request)).code, 'access-denied')
}

const root = await mkdtemp(path.join(os.tmpdir(), 'argo-packaged-project-'))
let application
try {
  const fixture = await prepare(root)
  const before = await readFile(fixture.registryPath, 'utf8')
  application = await electron.launch({
    executablePath: path.join(fixture.application, 'Contents', 'MacOS', 'Argo'),
    env: { ...process.env, [PROJECT_PROOF_STORE_ENV]: fixture.userData, [ACCEPTANCE_ENV]: '0' },
    timeout: 30_000,
  })
  await prove(application, fixture)
  assert.equal(await readFile(fixture.registryPath, 'utf8'), before)
  assert.equal(
    (await readFuseWire(packagedApp('arm64'))).every((fuse) => fuse.matches),
    true,
  )
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
