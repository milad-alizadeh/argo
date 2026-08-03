import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
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

// Seam A end-to-end over the REAL observation pipeline: a transcript on disk plus a registered
// Project must reach the rail as a row (transcript → observer → hub → IPC → Zustand → rail).
// Both worlds are built here rather than seeded into the hub, so what the window renders is
// what the app would derive from a genuine `~/.claude/projects` — the synthetic demo seed is
// gone. `--user-data-dir` is Electron's own switch for relocating `userData`, which is where
// the Project registry lives.
let app: ElectronApplication
let window: Page
let sandbox: string

const TITLE = 'Refactor auth module'

function buildWorld(): { transcripts: string; userData: string } {
  sandbox = mkdtempSync(join(tmpdir(), 'argo-e2e-'))
  const workspace = join(sandbox, 'argo')
  const transcripts = join(sandbox, 'transcripts')
  const userData = join(sandbox, 'userData')
  for (const path of [workspace, join(transcripts, 'project-argo'), userData]) {
    mkdirSync(path, { recursive: true })
  }

  // One session's worth of records: an ai-title (a DIRECT title), a prompt and a reply that
  // ends its turn. No `claude` process runs against this folder, so the honest reading of it
  // is `idle` — which is exactly the degradation the rail must show rather than a false live.
  const stamp = new Date().toISOString()
  const records = [
    { type: 'last-prompt', leafUuid: 'e2e-root', sessionId: 'e2e-session' },
    { type: 'attachment', cwd: workspace, timestamp: stamp, uuid: 'e2e-root', parentUuid: null },
    { type: 'ai-title', aiTitle: TITLE },
    {
      type: 'user',
      cwd: workspace,
      timestamp: stamp,
      uuid: 'e2e-turn',
      parentUuid: 'e2e-root',
      message: { role: 'user', content: 'Refactor the auth module' },
    },
    {
      type: 'assistant',
      cwd: workspace,
      timestamp: stamp,
      uuid: 'e2e-reply',
      parentUuid: 'e2e-turn',
      message: {
        role: 'assistant',
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Done.' }],
      },
    },
  ]
  writeFileSync(
    join(transcripts, 'project-argo', 'e2e-session.jsonl'),
    `${records.map((record) => JSON.stringify(record)).join('\n')}\n`,
  )

  writeFileSync(
    join(userData, 'projects.json'),
    JSON.stringify({
      activeProjectId: 'e2e-project',
      projects: [{ id: 'e2e-project', path: workspace }],
    }),
  )

  return { transcripts, userData }
}

test.beforeAll(async () => {
  const { transcripts, userData } = buildWorld()
  app = await electron.launch({
    args: [join(here, '..', 'out', 'main', 'index.js'), `--user-data-dir=${userData}`],
    env: {
      ...process.env,
      ELECTRON_DISABLE_SANDBOX: '1',
      ARGO_TRANSCRIPT_ROOT: transcripts,
    },
  })
  window = await app.firstWindow()
})

test.afterAll(async () => {
  await app?.close()
  rmSync(sandbox, { recursive: true, force: true })
})

test('projects an observed Session into a rail row', async () => {
  const list = window.getByRole('list', { name: 'Sessions' })
  await expect(list.getByText(TITLE)).toBeVisible()
  await expect(list.getByText('claude')).toBeVisible()
  // No live process behind the transcript: the row degrades down rather than claiming Running.
  await expect(list.getByText('Idle')).toBeVisible()
  await expect(window.getByText('No Sessions observed yet.')).toBeHidden()
})

// A registered Project takes a tab in the strip, and the active one stays quiet: its own
// sessions are a glance away in the roster, so a badge on it would be a second telling.
test('projects a registered Project into a quiet active strip tab', async () => {
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
