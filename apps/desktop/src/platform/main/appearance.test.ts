// `nativeTheme` only exists inside a running Electron process, so this bridge test stands Electron
// in. The stand-in is shared with every other test that does, for the reason written beside it, and
// it is registered before the dynamic imports below, since a static import of `./bridge` would
// resolve the real `electron` package first.
import { mock } from 'bun:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { electronStandIn } from '@/platform/main/test-doubles/electron-stand-in'

mock.module('electron', () => electronStandIn)

const [
  { createMockIpcWindow, RENDERER_URL },
  { APPEARANCE_OPERATIONS },
  { attachAppearanceBridge },
] = await Promise.all([
  import('../../../mocks/contract/mock-ipc-window'),
  import('@/platform/contract/appearance'),
  import('@/platform/main/appearance'),
])

test('an untrusted set is refused, and a later trusted get shows the appearance from before', async (context) => {
  const userData = await mkdtemp(path.join(os.tmpdir(), 'argo-appearance-'))
  context.after(() => rm(userData, { recursive: true, force: true }))
  const ipc = createMockIpcWindow()
  attachAppearanceBridge(ipc.window, { userData, rendererURL: RENDERER_URL })

  const denied = (await ipc.untrustedInvoke(APPEARANCE_OPERATIONS.set.channel, {
    version: 1,
    type: 'appearance.set',
    requestId: 'r1',
    appearance: 'dark',
  })) as { type: string; code: string }
  assert.equal(denied.type, 'appearance.error')
  assert.equal(denied.code, 'access-denied')

  const after = (await ipc.trustedInvoke(APPEARANCE_OPERATIONS.get.channel, {
    version: 1,
    type: 'appearance.get',
    requestId: 'r2',
  })) as { appearance: string }
  assert.equal(after.appearance, 'system')
})

test('a field this build does not own survives a change of appearance', async (context) => {
  const userData = await mkdtemp(path.join(os.tmpdir(), 'argo-appearance-'))
  context.after(() => rm(userData, { recursive: true, force: true }))
  const settingsPath = path.join(userData, 'portable-v1', 'appearance.json')
  await mkdir(path.dirname(settingsPath), { recursive: true })
  await writeFile(
    settingsPath,
    JSON.stringify({ version: 1, appearance: 'light', importedFrom: 'swift' }),
  )

  const ipc = createMockIpcWindow()
  attachAppearanceBridge(ipc.window, { userData, rendererURL: RENDERER_URL })
  await ipc.trustedInvoke(APPEARANCE_OPERATIONS.set.channel, {
    version: 1,
    type: 'appearance.set',
    requestId: 'r1',
    appearance: 'dark',
  })

  assert.deepEqual(JSON.parse(await readFile(settingsPath, 'utf8')), {
    version: 1,
    appearance: 'dark',
    importedFrom: 'swift',
  })
})
