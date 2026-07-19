import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  type ElectronApplication,
  _electron as electron,
  expect,
  type Page,
  test,
} from '@playwright/test'

// The spec runs as ESM (the app is "type": "module"), so __dirname isn't a global.
const here = dirname(fileURLToPath(import.meta.url))

// App-launch smoke: boot the packaged main process and assert the window renders.
// Requires `electron-vite build` to have produced out/ (the test:e2e script does this).
let app: ElectronApplication
let window: Page

test.beforeAll(async () => {
  app = await electron.launch({
    args: [join(here, '..', 'out', 'main', 'index.js')],
    // Headless CI has no display server; tell Chromium not to require one.
    env: { ...process.env, ELECTRON_DISABLE_SANDBOX: '1' },
  })
  window = await app.firstWindow()
})

test.afterAll(async () => {
  await app?.close()
})

test('boots to a window titled Argo Cockpit', async () => {
  await expect(window).toHaveTitle('Argo Cockpit')
})

test('renders the empty cockpit root', async () => {
  const root = window.getByTestId('cockpit-root')
  await expect(root).toBeVisible()
  await expect(window.getByText('No Sessions observed yet.')).toBeVisible()
})
