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

// Seam A end-to-end: with a synthetic Session seeded into the hub, the projection
// pipeline (hub → IPC → Zustand → rail) must render a row in a real window — the
// ticket's "feed a session-created event and see a row appear" demo, automated.
let app: ElectronApplication
let window: Page

test.beforeAll(async () => {
  app = await electron.launch({
    args: [join(here, '..', 'out', 'main', 'index.js')],
    env: { ...process.env, ELECTRON_DISABLE_SANDBOX: '1', ARGO_SEED_DEMO: '1' },
  })
  window = await app.firstWindow()
})

test.afterAll(async () => {
  await app?.close()
})

test('projects a seeded Session into a rail row', async () => {
  const list = window.getByRole('list', { name: 'Sessions' })
  await expect(list.getByText('Refactor auth module')).toBeVisible()
  await expect(list.getByText('claude')).toBeVisible()
  await expect(list.getByText('Running')).toBeVisible()
  await expect(window.getByText('No Sessions observed yet.')).toBeHidden()
})

// A registered Project takes a tab in the strip, and the active one stays quiet: its own
// sessions are a glance away in the roster, so a badge on it would be a second telling.
test('projects a seeded Project into a quiet active strip tab', async () => {
  const tab = window.getByRole('navigation', { name: 'Projects' }).getByRole('button', {
    name: 'argo',
  })
  await expect(tab).toHaveAttribute('aria-current', 'true')
  await expect(tab.getByRole('img')).toBeHidden()
})

// ⌘2 leaves the running world for the backlog, and ⌘1 comes back — the room switch is the
// shell's, and it survives whatever the room is showing.
test('switches rooms with the canonical keymap', async () => {
  const rooms = window.getByRole('navigation', { name: 'Rooms' })
  await window.keyboard.press('Meta+2')
  await expect(rooms.getByRole('button', { name: /Work/ })).toHaveAttribute('aria-current', 'page')
  await expect(window.getByRole('list', { name: 'Sessions' })).toBeHidden()
  await window.keyboard.press('Meta+1')
  await expect(window.getByRole('list', { name: 'Sessions' })).toBeVisible()
})
