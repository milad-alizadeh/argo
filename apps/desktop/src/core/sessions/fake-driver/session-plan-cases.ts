import assert from 'node:assert/strict'

export async function proveSessionPlan(page, update) {
  await page.evaluate(() => {
    window.location.hash = '#/sessions/plannedWork'
  })
  const plan = page.getByRole('button', { name: 'Open task plan' })
  await plan.click()
  await page.getByRole('list', { name: 'Task plan' }).waitFor()
  await update()
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('[data-plan-status="in_progress"]')].some((entry) =>
        entry.textContent?.includes('Ship the Session Plan'),
      ) && window.location.hash === '#/sessions/plannedWork',
    undefined,
    { timeout: 10_000 },
  )
  assert.equal(await page.evaluate(() => window.location.hash), '#/sessions/plannedWork')
}
