import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { setTimeout } from 'node:timers/promises'
import type { Page } from 'playwright-core'

const THREAD = 'rollout-codexParent'
const NAME = 'Named by Codex Desktop'

type RosterTitle = { id: string; title: { text: string; source: string } | null }

// The vendor name arrives through app-server. The rollout file is only the invalidation signal.
function writeVendorName(root: string) {
  mkdirSync(root, { recursive: true })
  writeFileSync(
    path.join(root, 'argo-vendor-history.json'),
    JSON.stringify({
      threads: [
        {
          id: THREAD,
          cwd: null,
          name: NAME,
          updatedAt: null,
          status: { type: 'idle' },
          turns: [],
        },
      ],
    }),
  )
}

async function rosterTitle(page: Page) {
  const reply = await page.evaluate(() => window.argo.listSessions({ projectRoot: null }))
  assert.equal(reply.type, 'session.listed')
  return reply.sessions.find((session: RosterTitle) => session.id === THREAD)?.title ?? null
}

// ADR-0042: the packaged main process opens the store through Electron's own `node:sqlite`.
export async function proveCodexThreadName(page: Page, root: string) {
  assert.deepEqual(await rosterTitle(page), { text: 'Run Codex check', source: 'first-prompt' })
  writeVendorName(root)
  const deadline = Date.now() + 10_000
  let title = await rosterTitle(page)
  while (title?.text !== NAME && Date.now() < deadline) {
    await setTimeout(100)
    title = await rosterTitle(page)
  }
  assert.deepEqual(title, { text: NAME, source: 'custom' })
}
