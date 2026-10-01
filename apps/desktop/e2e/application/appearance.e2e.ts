import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { ElectronApplication } from 'playwright-core'
import { closeApplication } from '../application-under-test'
import { test as base, expect } from '../packaged-proof'
import { launch, prepare } from '../projects/fixtures/project.fixture'

const test = base.extend<{
  appearanceDocument: string | undefined
  themeFixture: Awaited<ReturnType<typeof prepare>>
}>({
  appearanceDocument: [undefined, { option: true }],
  themeFixture: async ({ root, applicationUnderTest, appearanceDocument }, use) => {
    const fixture = await prepare(root, applicationUnderTest)
    if (appearanceDocument !== undefined) {
      await mkdir(path.join(fixture.userData, 'portable-v1'), { recursive: true })
      await writeFile(
        path.join(fixture.userData, 'portable-v1/appearance.json'),
        appearanceDocument,
      )
    }
    await use(fixture)
  },
})

async function ready(application: ElectronApplication) {
  await application.evaluate(({ app }) => app.whenReady())
  const page = await application.firstWindow()
  await page.waitForFunction(() => Boolean(document.documentElement.dataset.theme))
  return page
}

async function selectPreferences(application: ElectronApplication) {
  const page = await ready(application)
  const harnessFolders = await application.evaluate(() => [
    process.env.CLAUDE_CONFIG_DIR,
    process.env.CODEX_HOME,
  ])
  expect(harnessFolders.every((folder) => folder?.includes('/argo-harness-folders-'))).toBe(true)
  expect(
    await page.evaluate(() => ({
      theme: document.documentElement.dataset.theme,
      dark: document.documentElement.classList.contains('dark'),
      scheme: document.documentElement.style.colorScheme,
    })),
  ).toEqual({ theme: 'neutral', dark: false, scheme: 'light' })
  expect(
    await application.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.getBackgroundColor().toLowerCase(),
    ),
  ).toBe('#ffffff')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Appearance', exact: true })
  await dialog.getByRole('radio', { name: 'Graphite', exact: true }).check()
  await expect(dialog.getByRole('radio', { name: 'Graphite', exact: true })).toBeChecked()
  await dialog.getByRole('radio', { name: 'Dark', exact: true }).check()
  await expect
    .poll(() => page.evaluate(() => window.argo.getAppearance()))
    .toMatchObject({
      theme: 'graphite',
      appearance: 'dark',
      dark: true,
    })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeFocused()
  return page
}

async function synchronizeWindows(application: ElectronApplication) {
  const appPath = await application.evaluate(({ app }) => app.getAppPath())
  const preload = path.join(appPath, '.vite/build/preload.js')
  const nextWindow = application.waitForEvent('window')
  await application.evaluate(({ BrowserWindow }, preloadPath) => {
    const first = BrowserWindow.getAllWindows()[0]
    if (!first) throw new Error('Missing primary window')
    const second = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    })
    void second.loadURL(first.webContents.getURL())
  }, preload)
  const second = await nextWindow
  await second.waitForFunction(() => document.documentElement.dataset.theme === 'graphite')
  expect(await second.evaluate(() => window.argo.getAppearance())).toMatchObject({
    theme: 'graphite',
    appearance: 'dark',
    dark: true,
  })
  const page = await application.firstWindow()
  await page.evaluate(() => window.argo.setAppearance({ theme: 'neutral', appearance: 'dark' }))
  await expect
    .poll(() => second.evaluate(() => document.documentElement.dataset.theme))
    .toBe('neutral')
  expect(await second.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(
    true,
  )
  await expect
    .poll(() =>
      application.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().map((window) => window.getBackgroundColor().toLowerCase()),
      ),
    )
    .toEqual(['#0a0a0a', '#0a0a0a'])
}

async function systemAndRejection(application: ElectronApplication) {
  const page = await application.firstWindow()
  await page.evaluate(() => window.argo.setAppearance({ theme: 'graphite', appearance: 'system' }))
  const systemDark = await application.evaluate(
    ({ nativeTheme }) => nativeTheme.shouldUseDarkColors,
  )
  expect(await page.evaluate(() => window.argo.getAppearance())).toMatchObject({
    theme: 'graphite',
    appearance: 'system',
    dark: systemDark,
  })
  await page.evaluate(() => window.argo.setAppearance({ theme: 'graphite', appearance: 'light' }))
  const before = await page.evaluate(() => window.argo.getAppearance())
  const rejection = await page.evaluate(async () => {
    try {
      await window.argo.setAppearance({ theme: 'unknown', appearance: 'light' } as never)
      return false
    } catch {
      return true
    }
  })
  expect(rejection).toBe(true)
  expect(await page.evaluate(() => window.argo.getAppearance())).toEqual(before)
  await application.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.webContents.send('argo:appearance:changed', {
      theme: 'unknown',
      appearance: 'dark',
      dark: true,
      revision: 9999,
    })
  })
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('graphite')
}

test.describe('saved preference', () => {
  test.use({ appearanceDocument: JSON.stringify({ appearance: 'light', foreignField: 'keep' }) })
  test('selects themes and appearance, synchronizes app windows, and restarts with accepted state', async ({
    themeFixture,
  }) => {
    let application = await launch(themeFixture)
    try {
      await selectPreferences(application)
      await synchronizeWindows(application)
      await systemAndRejection(application)
      await closeApplication(application)
      application = await launch(themeFixture)
      const reopened = await ready(application)
      expect(await reopened.evaluate(() => window.argo.getAppearance())).toMatchObject({
        theme: 'graphite',
        appearance: 'light',
        dark: false,
      })
      expect(
        JSON.parse(
          await readFile(path.join(themeFixture.userData, 'portable-v1/appearance.json'), 'utf8'),
        ),
      ).toEqual({
        theme: 'graphite',
        appearance: 'light',
        foreignField: 'keep',
      })
    } finally {
      await closeApplication(application)
    }
  })
})

for (const [name, document] of [
  ['missing', undefined],
  ['malformed', '{'],
  ['unknown', '{"theme":"unknown","appearance":"light"}'],
] as const) {
  test.describe(name, () => {
    test.use({ appearanceDocument: document })
    test('starts with Neutral and the resolved System appearance', async ({ themeFixture }) => {
      const application = await launch(themeFixture)
      try {
        const page = await ready(application)
        const dark = await application.evaluate(
          ({ nativeTheme }) => nativeTheme.shouldUseDarkColors,
        )
        expect(await page.evaluate(() => window.argo.getAppearance())).toMatchObject({
          theme: 'neutral',
          appearance: 'system',
          dark,
        })
        expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(
          dark,
        )
      } finally {
        await closeApplication(application)
      }
    })
  })
}
