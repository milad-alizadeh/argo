// Search reaches the full indexed history, not just the SessionList's own loaded window (#2375): a
// Session buried behind enough filler Sessions to sit outside the first bounded window is still
// findable and openable by title through the search box.
import type { Page } from 'playwright-core'
import { BURIED_SEARCH_TARGET_ID } from '../fixtures/search-window.fixture'

const ROW = 'nav[aria-label="Sessions"] button[data-session-id]'

export async function proveSearchFindsABuriedSession(page: Page) {
  await page.reload()
  await page.locator(ROW).first().waitFor()

  // Not in the loaded window at all until search resolves it off the index.
  await page
    .locator(`${ROW}[data-session-id="${BURIED_SEARCH_TARGET_ID}"]`)
    .waitFor({ state: 'detached' })

  const search = page.getByRole('textbox', { name: 'Search Sessions' })
  await search.click()
  await search.fill('quarry expansion')

  const found = page.locator(`${ROW}[data-session-id="${BURIED_SEARCH_TARGET_ID}"]`)
  await found.waitFor()
  await found.click()

  await page.waitForFunction(
    (id) => window.location.hash === `#/sessions/${id}`,
    BURIED_SEARCH_TARGET_ID,
  )
  await page.waitForSelector(
    `.feed__viewport[data-session="${BURIED_SEARCH_TARGET_ID}"] [data-feed-row]`,
  )
}
