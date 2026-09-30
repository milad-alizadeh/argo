// Search reaches the full indexed history, not just the Roster's own loaded window (#2375): a
// Session buried behind enough filler Sessions to sit outside the first bounded window is still
// findable and openable by title through the search box.
import type { Page } from 'playwright-core'
import { fixtureSession } from '../fixture-sessions'
import { BURIED_SEARCH_TARGET } from '../fixtures/search-window.fixture'
import { refreshSessions } from '../gestures'

const ROW = 'nav[aria-label="Sessions"] button[data-session-id]'

export async function proveSearchFindsABuriedSession(page: Page) {
  await refreshSessions(page)
  const buriedId = await fixtureSession(BURIED_SEARCH_TARGET)
  await page.reload()
  await page.locator(ROW).first().waitFor()

  // Not in the loaded window at all until search resolves it off the index.
  await page.locator(`${ROW}[data-session-id="${buriedId}"]`).waitFor({ state: 'detached' })

  const search = page.getByRole('textbox', { name: 'Search Sessions' })
  await search.click()
  await search.fill('quarry expansion')

  const found = page.locator(`${ROW}[data-session-id="${buriedId}"]`)
  await found.waitFor()
  await found.click()

  await page.waitForFunction((id) => window.location.hash.endsWith(`/sessions/${id}`), buriedId)
  await page.waitForSelector(`.feed__viewport[data-session="${buriedId}"] [data-feed-row]`)
}
