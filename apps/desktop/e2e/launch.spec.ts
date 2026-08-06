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
    env: {
      ...process.env,
      // Headless CI has no display server; tell Chromium not to require one.
      ELECTRON_DISABLE_SANDBOX: '1',
      // "Honestly empty" has to mean empty: point the observer at a root with no transcripts,
      // so a developer's own session history cannot populate the shell this asserts is bare.
      ARGO_TRANSCRIPT_ROOT: join(here, '..', 'out', 'no-transcripts'),
    },
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

// The empty shell's seam hands off to onboarding (#165/#265), and onboarding IS creating a
// Project — so what it opens is the project-setup panel, reached through Welcome. This is the
// wiring a story cannot prove: the seam, the panel and the real preload bridge in one window.
test('hands the empty shell off to onboarding', async () => {
  await window.getByRole('button', { name: 'Connect a provider' }).click()
  await expect(window.getByRole('heading', { name: 'Welcome to Argo' })).toBeVisible()

  await window.getByRole('button', { name: 'Get started' }).click()
  await expect(window.getByRole('heading', { name: 'Set up your project' })).toBeVisible()
  // A folder is the only thing a Project requires, and none has been chosen yet.
  await expect(window.getByRole('button', { name: 'Create project' })).toBeDisabled()
  await expect(window.getByRole('button', { name: 'Sign in to GitHub' })).toBeVisible()
})
