import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { setTimeout } from 'node:timers/promises'
import type { Page } from 'playwright-core'
import { createSessionByClick, openSessionByClick } from '../gestures'
import type { SessionHarnessBackend } from '../session-harness-backend'

type Restart = () => Promise<Page>

const OPENING_PROMPT = 'Open the Codex resume proof.'
const RESUMING_PROMPT = 'Carry on after the restart.'
const REFUSAL = 'Another Codex client holds this Session.'

async function markVendorActive(root: string, sessionId: string) {
  const file = path.join(root, 'argo-vendor-history.json')
  const stored = JSON.parse(await readFile(file, 'utf8')) as {
    threads: { id: string; status: { type: string; message?: string } }[]
  }
  const thread = stored.threads.find((candidate) => candidate.id === sessionId)
  assert.ok(thread !== undefined)
  thread.status = { type: 'active', message: REFUSAL }
  await writeFile(file, JSON.stringify(stored))
}

async function rosterRow(page: Page, sessionId: string) {
  const reply = await page.evaluate(() => window.argo.listSessions({ projectRoot: null }))
  assert.equal(reply.type, 'session.listed')
  return reply.sessions.filter((session: { id: string }) => session.id === sessionId)
}

async function sendFromComposer(page: Page, text: string) {
  const composer = page.getByRole('combobox', { name: 'Message' })
  await composer.click()
  await page.keyboard.type(text)
  await page.keyboard.press('Enter')
}

async function managedRosterRow(page: Page, sessionId: string, budgetMs: number) {
  const deadline = Date.now() + budgetMs
  while (Date.now() < deadline) {
    const rows = await rosterRow(page, sessionId)
    if (rows.some((row: { posture: string }) => row.posture === 'managed')) return rows
    await setTimeout(100)
  }
  throw new Error(`Session ${sessionId} did not become managed after resuming.`)
}

export async function provePackagedCodexResume(
  page: Page,
  { backend, restart }: { backend: SessionHarnessBackend; restart: Restart },
) {
  const sessionId = await createSessionByClick(page, { harness: 'codex', prompt: OPENING_PROMPT })

  const relaunched = await restart()
  const [reread] = await rosterRow(relaunched, sessionId)
  assert.equal(reread?.posture, 'watched')
  await openSessionByClick(relaunched, sessionId)
  const history = relaunched.getByRole('region', { name: 'Session history' })
  await backend.waitForReply(relaunched, { harness: 'codex', prompt: OPENING_PROMPT })

  await sendFromComposer(relaunched, RESUMING_PROMPT)
  await backend
    .waitForReply(relaunched, { harness: 'codex', prompt: RESUMING_PROMPT })
    .catch(async (error) => {
      const rows = await history.locator('[data-feed-row]').allTextContents()
      const alerted = await relaunched.locator('[role="alert"]').allTextContents()
      const [row] = await rosterRow(relaunched, sessionId)
      throw new Error(
        `${error.message}\nFeed rows: ${JSON.stringify(rows)}\nAlerts: ${JSON.stringify(alerted)}\nRoster row: ${JSON.stringify(row)}`,
      )
    })
  // The optimistic Turn row (#2099) shows the sent prompt in the Feed before the roster
  // invalidation that follows a Send lands, so the Roster's posture catches up on its own poll
  // rather than by the time the message is visible.
  const resumed = await managedRosterRow(relaunched, sessionId, backend.budgetMs)
  assert.deepEqual(
    resumed.map(({ id, posture }: { id: string; posture: string }) => ({ id, posture })),
    [{ id: sessionId, posture: 'managed' }],
  )
  return relaunched
}

export async function provePackagedCodexResumeRefusal(
  page: Page,
  {
    restart,
    root,
  }: {
    restart: Restart
    root: string
  },
) {
  const sessionId = await createSessionByClick(page, {
    harness: 'codex',
    prompt: 'Open the Codex refusal proof.',
  })
  const relaunched = await restart(() => markVendorActive(root, sessionId))
  await openSessionByClick(relaunched, sessionId)
  await sendFromComposer(relaunched, 'Try to take over this active Session.')
  const alert = relaunched.getByRole('alert')
  await alert.waitFor()
  assert.match((await alert.textContent()) ?? '', new RegExp(REFUSAL))
  const [row] = await rosterRow(relaunched, sessionId)
  assert.equal(row?.posture, 'watched')
}
