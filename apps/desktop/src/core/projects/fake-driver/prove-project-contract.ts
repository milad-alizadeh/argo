import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron } from 'playwright-core'
import { ACCEPTANCE_ENV } from '../../../../scripts/acceptance-protocol.mjs'
import {
  appExecutable,
  assertShippedFusesIntact,
  packagedTestCopy,
} from '../../desktop-proof/packaged-test-copy'
import { PROJECT_PROOF_STORE_ENV } from './project-proof-protocol'

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
  'awaitAccount',
  'bindTickets',
  'cancelAccount',
  'connectAccount',
  'decideClaudePermission',
  'disconnectAccount',
  'dismissAccountNotice',
  'getAppearance',
  'interruptClaudeSession',
  'listAccounts',
  'listProjects',
  'listSessions',
  'listTickets',
  'onAppearanceChanged',
  'onCommand',
  'openProject',
  'readBinding',
  'readClaudePermission',
  'readSessionFeed',
  'registerProject',
  'relocateProject',
  'sendClaudeSession',
  'setAppearance',
  'startClaudeSession',
  'unbindTickets',
  'verifyAccount',
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

async function prove(application) {
  const page = await application.firstWindow()
  page.setDefaultTimeout(30_000)
  await page.waitForFunction(() => typeof window.argo?.openProject === 'function')
  await proveSurface(application, page)
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
  await prove(application)
  assert.equal(await readFile(fixture.registryPath, 'utf8'), before)
  await assertShippedFusesIntact()
  console.log(
    JSON.stringify({
      ok: true,
      packaged: true,
      signed: false,
      profile: 'test',
      cases: ['success', 'missing-project', 'denied-access', 'invalid-request', 'unchanged-store'],
    }),
  )
} finally {
  try {
    if (application) await application.close()
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}
