import assert from 'node:assert/strict'
import { writeFixtureTree } from './session-fixture-files'

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

export async function provePackagedReread(page, transcripts) {
  const before = await page.locator('nav[aria-label="Sessions"] button').count()
  await writeFixtureTree(transcripts, ['titledHeadless'], { directory: 'project-two' })
  await page.getByRole('button', { name: 'Read again' }).click()
  await page.getByRole('button', { name: /The name a person typed/ }).waitFor()
  assert.equal(await page.locator('nav[aria-label="Sessions"] button').count(), before + 1)
}
