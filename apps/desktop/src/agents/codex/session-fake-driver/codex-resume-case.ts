import assert from 'node:assert/strict'
import type { Page } from 'playwright-core'

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

export async function provePackagedCodexResume(
  page: Page,
  { project, restart }: { project: string; restart: Restart },
) {
  const started = await page.evaluate(
    (cwd: string) =>
      window.argo.startSession({
        cli: 'codex',
        cwd,
        prompt: 'Open the Codex resume proof.',
      }),
    project,
  )
  assert.equal(started.type, 'session.started', JSON.stringify(started))
  const sessionId = started.sessionId
  await page.waitForFunction(
    (id: string) =>
      window.argo.listSessions().then((reply) => reply.sessions?.some((row) => row.id === id)),
    sessionId,
  )

  const relaunched = await restart()
  const [reread] = await rosterRow(relaunched, sessionId)
  assert.equal(reread?.posture, 'external')
  await relaunched
    .locator(`nav[aria-label="Sessions"] button[data-session-id="${sessionId}"]`)
    .click()
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
  const resumed = await rosterRow(relaunched, sessionId)
  assert.deepEqual(
    resumed.map(({ id, posture }: { id: string; posture: string }) => ({ id, posture })),
    [{ id: sessionId, posture: 'managed' }],
  )
  return relaunched
}
