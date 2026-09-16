import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { setTimeout } from 'node:timers/promises'
import type { Page } from 'playwright-core'
import { codexStatePath } from '../sessions/roots'

const THREAD = 'rollout-codexParent'
const NAME = 'Named by Codex Desktop'

type RosterTitle = { id: string; title: { text: string; source: string } | null }

// Codex Desktop's own store, written beside the fixture rollouts where the packaged app looks.
function writeStateStore(codexTranscripts: string) {
  const store = new DatabaseSync(codexStatePath(codexTranscripts))
  store.exec('CREATE TABLE threads (id TEXT PRIMARY KEY, title TEXT, name TEXT)')
  store.prepare('INSERT INTO threads (id, name) VALUES (?, ?)').run(THREAD, NAME)
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
  assert.deepEqual(title, { text: NAME, source: 'summarised' })
}
