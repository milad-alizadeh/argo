// `nativeTheme` only exists inside a running Electron process, so this is the one bridge test in
// the suite that stands Electron itself in: nothing else in this run imports it. The stand-in is
// registered before the dynamic imports below, since a static import of `./bridge` would resolve
// the real `electron` package first.
import { mock } from 'bun:test'

const theme = { themeSource: 'system' as 'system' | 'light' | 'dark', shouldUseDarkColors: true }

mock.module('electron', () => ({
  nativeTheme: {
    get themeSource() {
      return theme.themeSource
    },
    set themeSource(value: 'system' | 'light' | 'dark') {
      theme.themeSource = value
    },
    get shouldUseDarkColors() {
      return theme.shouldUseDarkColors
    },
    on: () => undefined,
    off: () => undefined,
  },
}))

const [
  { mkdir, mkdtemp, readFile, rm, writeFile },
  os,
  path,
  { test },
  assert,
  { createFakeIpcWindow, RENDERER_URL },
  { APPEARANCE_OPERATIONS },
  { attachAppearanceBridge },
] = await Promise.all([
  import('node:fs/promises'),
  import('node:os').then((module) => module.default),
  import('node:path').then((module) => module.default),
  import('node:test'),
  import('node:assert/strict').then((module) => module.default),
  import('../contract/test-support'),
  import('./appearance'),
  import('./bridge'),
])

test('an untrusted set is refused, and a later trusted get shows the appearance from before', async (context) => {
  const userData = await mkdtemp(path.join(os.tmpdir(), 'argo-appearance-'))
  context.after(() => rm(userData, { recursive: true, force: true }))
  const fake = createFakeIpcWindow()
  attachAppearanceBridge(fake.window, { userData, rendererURL: RENDERER_URL })

  const denied = (await fake.untrustedInvoke(APPEARANCE_OPERATIONS.set.channel, {
    version: 1,
    type: 'appearance.set',
    requestId: 'r1',
    appearance: 'dark',
  })) as { type: string; code: string }
  assert.equal(denied.type, 'appearance.error')
  assert.equal(denied.code, 'access-denied')

  const after = (await fake.trustedInvoke(APPEARANCE_OPERATIONS.get.channel, {
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

  const fake = createFakeIpcWindow()
  attachAppearanceBridge(fake.window, { userData, rendererURL: RENDERER_URL })
  await fake.trustedInvoke(APPEARANCE_OPERATIONS.set.channel, {
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
