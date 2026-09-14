import assert from 'node:assert/strict'
import type { Page } from 'playwright-core'
import {
  createSessionByClick,
  openSessionByClick,
} from '../../../core/sessions/fake-driver/session-gestures'

type Restart = () => Promise<Page>

async function rosterRow(page: Page, sessionId: string) {
  const reply = await page.evaluate(() => window.argo.listSessions())
  assert.equal(reply.type, 'session.listed')
  return reply.sessions.filter((session: { id: string }) => session.id === sessionId)
}

async function sendFromComposer(page: Page, text: string) {
  const composer = page.getByRole('textbox', { name: 'Message' })
  await composer.click()
  await page.keyboard.type(text)
  await page.keyboard.press('Enter')
}

export async function provePackagedCodexResume(page: Page, { restart }: { restart: Restart }) {
  const sessionId = await createSessionByClick(page, {
    cli: 'codex',
    prompt: 'Open the Codex resume proof.',
  })

  const relaunched = await restart()
  const [reread] = await rosterRow(relaunched, sessionId)
  assert.equal(reread?.posture, 'external')
  await openSessionByClick(relaunched, sessionId)
  const history = relaunched.getByRole('region', { name: 'Session history' })
  await history.getByText('Open the Codex resume proof.').waitFor()

  await sendFromComposer(relaunched, 'Carry on after the restart.')
  await history
    .getByText('Carry on after the restart.')
    .waitFor()
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
  await relaunched.waitForFunction(async (id) => {
    const reply = await window.argo.listSessions()
    return reply.sessions.some(
      (session: { id: string; posture: string }) =>
        session.id === id && session.posture === 'managed',
    )
  }, sessionId)
  const resumed = await rosterRow(relaunched, sessionId)
  assert.deepEqual(
    resumed.map(({ id, posture }: { id: string; posture: string }) => ({ id, posture })),
    [{ id: sessionId, posture: 'managed' }],
  )
  return relaunched
}
