import { expect } from '@playwright/test'
import type { Page } from 'playwright-core'
import { CODEX_PARENT } from '../../../mocks/sessions/mock-codex-thread-files'
import { fixtureSession } from '../fixture-sessions'
import { openSessionByClick, PERSISTED_ROW, waitForRoute } from '../gestures'

type Restart = () => Promise<Page>

function listedOrder(page: Page) {
  return page
    .locator(PERSISTED_ROW)
    .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-session-id')))
}

// A restart opens the selected Session and keeps the list order, for Claude and Codex alike.
export async function proveSelectionSurvivesRestart(page: Page, restart: Restart) {
  let current = page
  for (const name of ['prose', CODEX_PARENT]) {
    const sessionId = await fixtureSession(name)
    await openSessionByClick(current, sessionId)
    const order = await listedOrder(current)
    current = await restart()
    await waitForRoute(current, sessionId)
    await expect(
      current.locator(`nav[aria-label="Sessions"] button[data-session-id="${sessionId}"]`),
    ).toHaveAttribute('aria-current', 'page')
    await current.waitForSelector(`.feed__viewport[data-session="${sessionId}"] [data-feed-row]`)
    await expect.poll(() => listedOrder(current)).toEqual(order)
  }
}
