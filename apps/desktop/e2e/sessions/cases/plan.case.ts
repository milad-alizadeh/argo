import assert from 'node:assert/strict'
import { fixtureSession } from '../fixture-sessions'
import { openArchivedSessionByClick } from '../gestures'

export async function proveSessionPlan(page, update) {
  const sessionId = await fixtureSession('plannedWork')
  await openArchivedSessionByClick(page, sessionId)
  const plan = page.getByRole('button', { name: 'Open task plan' })
  await plan.click()
  await page.getByRole('list', { name: 'Task plan' }).waitFor()
  await update()
  const route = `/sessions/${sessionId}`
  await page.waitForFunction(
    (tail) =>
      [...document.querySelectorAll('[data-plan-status="in_progress"]')].some((entry) =>
        entry.textContent?.includes('Ship the Session Plan'),
      ) && window.location.hash.split('?')[0].endsWith(tail),
    route,
    { timeout: 10_000 },
  )
  assert.ok((await page.evaluate(() => window.location.hash.split('?')[0])).endsWith(route))
}
