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

// A machine with no registered Project is the honest-empty shell: the strip offers only `+`,
// the stage hosts the connect seam, and no room is faked behind it.
test('renders an honestly empty shell with nothing connected', async () => {
  await expect(window.getByRole('navigation', { name: 'Projects' })).toBeVisible()
  await expect(window.getByRole('button', { name: 'Add a project' })).toBeVisible()
  await expect(window.getByRole('button', { name: 'Connect a provider' })).toBeVisible()
  await expect(window.getByTestId('cockpit-root')).toBeHidden()
})

// The chrome is in every room, so it is there before any project is: the bar carries the room
// tabs and no wordmark, and the git group hides whole when there is no checkout to speak for.
test('renders the merged top bar without a wordmark or a branch', async () => {
  const rooms = window.getByRole('navigation', { name: 'Rooms' })
  await expect(rooms.getByRole('button', { name: /Sessions/ })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(rooms.getByRole('button', { name: /Work/ })).toBeVisible()
  await expect(rooms.getByRole('button', { name: /Code/ })).toBeVisible()
  await expect(window.getByRole('button', { name: 'Manage this branch' })).toBeHidden()
})
