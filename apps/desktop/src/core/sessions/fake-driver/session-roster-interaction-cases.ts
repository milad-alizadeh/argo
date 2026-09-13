import assert from 'node:assert/strict'

export async function provePackagedRosterSelection(page) {
  await page.evaluate(() => {
    window.location.hash = '#/sessions'
  })
  const first = page.locator('nav[aria-label="Sessions"] button').first()
  await first.waitFor()
  const sessionId = await first.getAttribute('data-session-id')
  assert.notEqual(sessionId, null)
  await first.focus()
  await page.keyboard.press('Enter')
  await page.waitForFunction((id) => window.location.hash === `#/sessions/${id}`, sessionId)
  await page.waitForSelector(`.feed__viewport[data-session="${sessionId}"] [data-feed-row]`)
  const selected = page.locator(`nav[aria-label="Sessions"] button[data-session-id="${sessionId}"]`)
  assert.equal(await selected.getAttribute('aria-current'), 'page')
  await page.keyboard.press('ArrowDown')
  const focusedSessionId = await page.evaluate(
    () => document.activeElement?.getAttribute('data-session-id') ?? null,
  )
  assert.notEqual(focusedSessionId, sessionId)
  assert.equal(await selected.getAttribute('aria-current'), 'page')
}
