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
  await page.keyboard.press('Shift+Enter')
}

export async function provePackagedCodexResume(page: Page, { restart }: { restart: Restart }) {
  const sessionId = await createSessionByClick(page, {
    cli: 'codex',
    prompt: 'Open the Codex resume proof.',
  })

  const relaunched = await restart()
  const [orphaned] = await rosterRow(relaunched, sessionId)
  assert.equal(orphaned?.posture, 'orphaned')
  await openSessionByClick(relaunched, sessionId)
  const history = relaunched.getByRole('region', { name: 'Session history' })
  await history.getByText('Open the Codex resume proof.').waitFor()

  await sendFromComposer(relaunched, 'Carry on after the restart.')
  await history.getByText('Carry on after the restart.').waitFor()
  const resumed = await rosterRow(relaunched, sessionId)
  assert.deepEqual(
    resumed.map(({ id, posture }: { id: string; posture: string }) => ({ id, posture })),
    [{ id: sessionId, posture: 'managed' }],
  )
  return relaunched
}
