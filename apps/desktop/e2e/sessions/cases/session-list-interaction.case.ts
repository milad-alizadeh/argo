import assert from 'node:assert/strict'
import { expect } from '@playwright/test'
import { deselectSession, openArchivedSessionByClick, openSessionByClick } from '../gestures'
import { readSessionListIds } from '../session-list-facts'

async function proveRetiredSelection(page, restart) {
  // No affordance writes the remembered selection directly, and this case needs it pointing at a
  // Session the next launch retires.
  await page.evaluate(() => window.localStorage.setItem('argo.selected-session-id', 'resumeChild'))
  const retired = await restart()
  await retired.waitForFunction(() => window.location.hash === '#/sessions/resumeParent')
  await retired.waitForSelector('.feed__viewport[data-session="resumeParent"] [data-feed-row]')
}

async function proveFreshOrder(page, previousOrder) {
  const refreshedOrder = await readSessionListIds(page)
  // Restarting discards the reader's remembered row order but never loses or revives an archive.
  assert.deepEqual([...refreshedOrder].sort(), [...previousOrder].sort())
}

export async function provePackagedSessionListSelection(page) {
  await deselectSession(page)
  const first = page.locator('nav[aria-label="Sessions"] button').first()
  await first.waitFor()
  const sessionId = await first.getAttribute('data-session-id')
  assert.notEqual(sessionId, null)
  await first.focus()
  await page.keyboard.press('Enter')
  await page.waitForFunction((id) => window.location.hash === `#/sessions/${id}`, sessionId)
  await page.waitForSelector(`.feed__viewport[data-session="${sessionId}"] [data-feed-row]`)
  const selected = page.locator(`nav[aria-label="Sessions"] button[data-session-id="${sessionId}"]`)
  await expect(selected).toHaveAttribute('aria-current', 'page')
  await page.keyboard.press('ArrowDown')
  const focusedSessionId = await page.evaluate(
    () => document.activeElement?.getAttribute('data-session-id') ?? null,
  )
  assert.notEqual(focusedSessionId, sessionId)
  await expect(selected).toHaveAttribute('aria-current', 'page')
}

async function proveArchivedRestart(page, restart) {
  await openArchivedSessionByClick(page, 'plannedWork')
  const archived = await restart()
  await archived.waitForFunction(() => window.location.hash === '#/sessions/plannedWork')
  // Restoring the selected archived Session widens the filter to All on its own, but only once the
  // reader's request for that row resolves, so this waits rather than reading the status once.
  await archived.locator('button[aria-label="Filter Sessions"]').click()
  await archived.getByRole('menuitemradio', { name: 'All', checked: true }).waitFor()
  await archived.keyboard.press('Escape')
  await archived
    .locator(
      'nav[aria-label="Sessions"] button[data-session-id="plannedWork"][data-archived="true"]',
    )
    .waitFor()
  await expect(
    archived.locator(
      'nav[aria-label="Sessions"] button[data-session-id="plannedWork"][data-archived="true"]',
    ),
  ).toHaveAttribute('aria-current', 'page')
  return archived
}

export async function provePackagedSessionListRestart(page, { remove, restart }) {
  await deselectSession(page)
  await openSessionByClick(page, 'prose')
  await page.waitForSelector('.feed__viewport[data-session="prose"] [data-feed-row]')
  await page
    .locator('nav[aria-label="Sessions"] button[data-session-id="rollout-codexParent"]')
    .waitFor()
  const sessionListFacts = await readSessionListIds(page)

  const relaunched = await restart()
  await relaunched.waitForFunction(() => window.location.hash === '#/sessions/prose')
  await relaunched.waitForSelector('.feed__viewport[data-session="prose"] [data-feed-row]')
  await proveFreshOrder(relaunched, sessionListFacts)
  await expect(
    relaunched.locator('nav[aria-label="Sessions"] button[data-session-id="prose"]'),
  ).toHaveAttribute('aria-current', 'page')

  const archived = await proveArchivedRestart(relaunched, restart)

  await openSessionByClick(archived, 'prose')
  await remove()
  const missing = await restart()
  // The restore navigates under a stale id too (#1593), and that id resolves to no Session.
  await missing.waitForFunction(() => window.location.hash === '#/sessions/prose')
  await missing.locator('nav[aria-label="Sessions"] button').first().waitFor()
  await expect(
    missing.locator('nav[aria-label="Sessions"] button[data-session-id="prose"]'),
  ).toHaveCount(0)
  await expect(
    missing.locator('nav[aria-label="Sessions"] button[aria-current="page"]'),
  ).toHaveCount(0)
  await expect(missing.getByRole('region', { name: 'Session history' })).toHaveCount(0)

  await proveRetiredSelection(missing, restart)
}
