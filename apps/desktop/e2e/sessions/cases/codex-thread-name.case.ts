import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { setTimeout } from 'node:timers/promises'
import type { Page } from 'playwright-core'
import { codexStatePath } from '@/harnesses/codex/sessions/discovery/roots'

const THREAD = 'rollout-codexParent'
const NAME = 'Named by Codex Desktop'

type RosterTitle = { id: string; title: { text: string; source: string } | null }

type ColumnInfo = { name: string; type: string; notnull: number; dflt_value: unknown }

// Codex Desktop's own store, written beside the fixture rollouts where the packaged app looks. The
// real backend's app spawns the real `codex` CLI for its own readiness check before this runs, and
// that CLI migrates its actual schema (many more NOT-NULL columns than this fixture cares about)
// into the same file (#2650), so this creates the table only if the CLI has not already, and fills
// whatever NOT-NULL columns that real schema demands with a harmless value instead of assuming a
// fixed shape.
function writeStateStore(codexTranscripts: string) {
  const store = new DatabaseSync(codexStatePath(codexTranscripts))
  store.exec('CREATE TABLE IF NOT EXISTS threads (id TEXT PRIMARY KEY, title TEXT, name TEXT)')
  const columns = store.prepare('PRAGMA table_info(threads)').all() as ColumnInfo[]
  const required = Object.fromEntries(
    columns
      .filter((column) => column.notnull === 1 && column.dflt_value === null)
      .map((column) => [column.name, column.type === 'INTEGER' ? 0 : ''] as const),
  )
  const row = { ...required, id: THREAD, name: NAME }
  const columnNames = Object.keys(row)
  store
    .prepare(
      `INSERT INTO threads (${columnNames.join(', ')})
       VALUES (${columnNames.map(() => '?').join(', ')})
       ON CONFLICT(id) DO UPDATE SET name = excluded.name`,
    )
    .run(...Object.values(row))
  // SQLite names a WAL-mode database's sidecar `-wal`/`-shm` files after the literal path a
  // connection opened, not the path's resolved target, so this write (through the fixture path)
  // and the app's read (through the real backend's symlink into `home/.codex`, #2650) keep
  // independent sidecars over the same underlying file. Truncating the checkpoint here folds
  // this connection's write into the main file's bytes, which is the only part every path shares.
  store.exec('PRAGMA wal_checkpoint(TRUNCATE)')
  store.close()
}

async function rosterTitle(page: Page) {
  const reply = await page.evaluate(() => window.argo.listSessions({ projectRoot: null }))
  assert.equal(reply.type, 'session.listed')
  return reply.sessions.find((session: RosterTitle) => session.id === THREAD)?.title ?? null
}

// ADR-0042: the packaged main process opens the store through Electron's own `node:sqlite`.
export async function proveCodexThreadName(page: Page, codexTranscripts: string) {
  assert.deepEqual(await rosterTitle(page), { text: 'Run Codex check', source: 'first-prompt' })
  writeStateStore(codexTranscripts)
  const deadline = Date.now() + 10_000
  let title = await rosterTitle(page)
  while (title?.text !== NAME && Date.now() < deadline) {
    await setTimeout(100)
    title = await rosterTitle(page)
  }
  assert.deepEqual(title, { text: NAME, source: 'custom' })
}
