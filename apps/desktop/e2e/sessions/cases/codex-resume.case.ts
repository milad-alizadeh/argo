import assert from 'node:assert/strict'
import { setTimeout } from 'node:timers/promises'
import type { Page } from 'playwright-core'
import { createSessionByClick, openSessionByClick } from '../gestures'
import type { SessionCliBackend } from '../session-cli-backend'

type Restart = () => Promise<Page>

const OPENING_PROMPT = 'Open the Codex resume proof.'
const RESUMING_PROMPT = 'Carry on after the restart.'

async function rosterRow(page: Page, sessionId: string) {
  const reply = await page.evaluate(() => window.argo.listSessions({ projectRoot: null }))
  assert.equal(reply.type, 'session.listed')
  return reply.sessions.filter((session: { id: string }) => session.id === sessionId)
}

async function sendFromComposer(page: Page, text: string) {
  const composer = page.getByRole('textbox', { name: 'Message' })
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
  { backend, restart }: { backend: SessionCliBackend; restart: Restart },
) {
  const sessionId = await createSessionByClick(page, { cli: 'codex', prompt: OPENING_PROMPT })

  const relaunched = await restart()
  const [reread] = await rosterRow(relaunched, sessionId)
  assert.equal(reread?.posture, 'external')
  await openSessionByClick(relaunched, sessionId)
  const history = relaunched.getByRole('region', { name: 'Session history' })
  await backend.waitForReply(relaunched, { cli: 'codex', prompt: OPENING_PROMPT })

  await sendFromComposer(relaunched, RESUMING_PROMPT)
  await backend
    .waitForReply(relaunched, { cli: 'codex', prompt: RESUMING_PROMPT })
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
