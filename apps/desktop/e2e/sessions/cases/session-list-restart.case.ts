import { expect } from '@playwright/test'
import type { Page } from 'playwright-core'
import { fixtureSession } from '../fixture-sessions'
import { CODEX_PARENT } from '../fixtures/feed.fixture'
import { openSessionByClick } from '../gestures'

type Restart = () => Promise<Page>

// A restart opens the Session the reader had selected, for a Claude and a Codex Session alike.
export async function proveSelectionSurvivesRestart(page: Page, restart: Restart) {
  let current = page
  for (const name of ['prose', CODEX_PARENT]) {
    const sessionId = await fixtureSession(name)
    await openSessionByClick(current, sessionId)
    current = await restart()
    await current.waitForFunction(
      (tail) => window.location.hash.split('?')[0].endsWith(tail),
      `/sessions/${sessionId}`,
    )
    await expect(
      current.locator(`nav[aria-label="Sessions"] button[data-session-id="${sessionId}"]`),
    ).toHaveAttribute('aria-current', 'page')
    await current.waitForSelector(`.feed__viewport[data-session="${sessionId}"] [data-feed-row]`)
  }
}
