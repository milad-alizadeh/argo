import assert from 'node:assert/strict'
import { openSession } from './session-roster-cases'

// The shipped Session page owns one selection across its Roster, header, Feed, composer slot and
// inspector. This proof reads that one visible slice after the real adapters project the fixtures.
export async function proveSessionShell(page) {
  const pageState = '[data-component="SessionPage"]'
  await page.waitForSelector(`${pageState}[data-state="unselected"]`)
  await openSession(page, 'Pick the ink', 'askPending')
  await page.waitForSelector(`${pageState}[data-state="read-only"]`)

  const selected = await page.evaluate(() => ({
    roster: document.querySelector('[data-component="SessionListItem"][aria-current="true"]')
      ?.textContent,
    header: document.querySelector('[data-component="SessionDeckHead"] h1')?.textContent,
    feed: document.querySelector('.feed__viewport')?.getAttribute('data-session'),
    composer: document.querySelector('[data-component="ComposerDock"]') !== null,
    inspector: document.querySelector('[data-component="SessionInspector"]') !== null,
  }))
  assert.equal(selected.roster?.includes('Pick the ink'), true)
  assert.equal(selected.header, 'Pick the ink')
  assert.equal(selected.feed, 'askPending')
  assert.equal(selected.composer, true)
  assert.equal(selected.inspector, false)
}
