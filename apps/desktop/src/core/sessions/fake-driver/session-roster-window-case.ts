// The Roster's bounded window, proved through the packaged app rather than the reader alone
// (#2239): scrolling the sentinel row into view grows the loaded window, and keyboard navigation
// keeps walking cleanly across whatever it just loaded.
import assert from 'node:assert/strict'
import type { Page } from 'playwright-core'
import { FARTHEST_WINDOW_FILLER_ID } from './session-roster-window-fixture'

const ROW = 'nav[aria-label="Sessions"] button[data-session-id]'
const SCROLL_ATTEMPTS = 40
const SCROLL_TIMEOUT_MS = 20_000

// The scrolled container is named rather than walked up to: the list's context menu wraps the nav
// inside it, so the nav's parent is that wrapper and setting its scrollTop scrolls nothing.
const SCROLLER = '[data-slot="roster-scroll"]'

function scrollRosterToEnd(page: Page) {
  return page.evaluate((selector) => {
    const scroller = document.querySelector(selector)
    if (scroller !== null) scroller.scrollTop = scroller.scrollHeight
  }, SCROLLER)
}

async function scrollUntilVisible(page: Page, selector: string) {
  const target = page.locator(selector)
  const deadline = Date.now() + SCROLL_TIMEOUT_MS
  for (let attempt = 0; attempt < SCROLL_ATTEMPTS; attempt += 1) {
    if ((await target.count()) > 0) return
    await scrollRosterToEnd(page)
    await page.waitForTimeout(50)
    if (Date.now() > deadline) break
  }
  // The window stopped growing before it reached the row, so the count it stopped at is the fact.
  const rows = await page.locator(ROW).count()
  throw new Error(`The window stopped growing at ${rows} rows, without ${selector}.`)
}

export async function proveRosterWindow(page: Page) {
  await page.reload()
  await page.locator(ROW).first().waitFor()

  // The farthest filler Session sits well outside the first bounded window (#2239): it is not in
  // the document at all until scrolling grows the window past it.
  assert.equal(
    await page.locator(`${ROW}[data-session-id="${FARTHEST_WINDOW_FILLER_ID}"]`).count(),
    0,
  )

  await scrollUntilVisible(page, `${ROW}[data-session-id="${FARTHEST_WINDOW_FILLER_ID}"]`)

  const farthest = page.locator(`${ROW}[data-session-id="${FARTHEST_WINDOW_FILLER_ID}"]`)
  await farthest.focus()
  await page.keyboard.press('ArrowUp')
  const afterUp = await page.evaluate(
    () => document.activeElement?.getAttribute('data-session-id') ?? null,
  )
  assert.notEqual(afterUp, FARTHEST_WINDOW_FILLER_ID)
  assert.notEqual(afterUp, null)

  // Selecting it the way a person would, past the boundary the scroll just crossed, still lands
  // on a real, readable Feed rather than a row the reader never actually resolved a Session for.
  await farthest.focus()
  await page.keyboard.press('Enter')
  await page.waitForFunction(
    (id) => window.location.hash === `#/sessions/${id}`,
    FARTHEST_WINDOW_FILLER_ID,
  )
  await page.waitForSelector(
    `.feed__viewport[data-session="${FARTHEST_WINDOW_FILLER_ID}"] [data-feed-row]`,
  )
}
