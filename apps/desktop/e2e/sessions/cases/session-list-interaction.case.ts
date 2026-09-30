import assert from 'node:assert/strict'
import { expect } from '@playwright/test'
import { deselectSession } from '../gestures'

export async function provePackagedSessionListSelection(page) {
  await deselectSession(page)
  const first = page.locator('nav[aria-label="Sessions"] button').first()
  await first.waitFor()
  const sessionId = await first.getAttribute('data-session-id')
  assert.notEqual(sessionId, null)
  await first.focus()
  await page.keyboard.press('Enter')
  await page.waitForFunction((id) => window.location.hash.endsWith(`/sessions/${id}`), sessionId)
  await page.waitForSelector(`.feed__viewport[data-session="${sessionId}"] [data-feed-row]`)
  await expect(page.getByLabel('Session composer')).toBeVisible()
  const selected = page.locator(`nav[aria-label="Sessions"] button[data-session-id="${sessionId}"]`)
  await expect(selected).toHaveAttribute('aria-current', 'page')
  await page.keyboard.press('ArrowDown')
  const focusedSessionId = await page.evaluate(
    () => document.activeElement?.getAttribute('data-session-id') ?? null,
  )
  assert.notEqual(focusedSessionId, sessionId)
  await expect(selected).toHaveAttribute('aria-current', 'page')
}
