// The diagram half of the packaged Session proof (#1836): a mermaid fence in real transcript
// content draws as a diagram, an incomplete fence gets an honest failure state instead of a
// blank one, and expanding a diagram into the inspector holds the Feed's reading anchor exactly
// where it was.

import assert from 'node:assert/strict'
import { expect } from '@playwright/test'
import { ACTIVE_VIEWPORT } from '../feed-selectors'

type DiagramFixture = {
  transcripts: string
  append: (transcripts: string, uuid: string, text: string) => Promise<void>
}

const DIAGRAM_ROW = 'p-diagram'
const SETTLE_TIMEOUT_MS = 10_000
// A width change reflows every row and the scroller corrects for it (ADR-0029) on its own
// schedule (a 180ms resize-settle debounce, then a measure pass), so the row's offset is read
// only once it has stopped moving rather than on the first frame after the width lands.
const REFLOW_SETTLE_MS = 500

// A long turn after the diagram, so scrolling the diagram into view leaves the reader above the tail,
// where the Feed holds the reader's row rather than following the tail.
const FOLLOWING_TEXT =
  'The turn after the diagram kept going while the reader looked back. '.repeat(120)

const DIAGRAM_TEXT = [
  'The Feed draws this diagram from the transcript itself.',
  '',
  '```mermaid',
  'flowchart LR',
  '  Backlog --> Ticket --> Session',
  '```',
  '',
  'And this fence is missing its target, so it cannot be drawn:',
  '',
  '```mermaid',
  'flowchart LR',
  '  Backlog -->',
  '```',
].join('\n')

function rowOffset(page, id) {
  return page.evaluate(
    ({ viewport, rowId }) => {
      const container = document.querySelector(viewport)
      const row = container?.querySelector(`[data-feed-row="${rowId}"]`)
      if (!container || !row) return null
      return row.getBoundingClientRect().top - container.getBoundingClientRect().top
    },
    { viewport: ACTIVE_VIEWPORT, rowId: `${id}:0` },
  )
}

async function waitForDrawnDiagrams(page) {
  await page.waitForFunction(
    (viewport) =>
      document.querySelectorAll(`${viewport} figure[data-component="FeedMermaid"] svg`).length >
        0 && document.querySelectorAll(`${viewport} [role="alert"]`).length > 0,
    ACTIVE_VIEWPORT,
    { timeout: SETTLE_TIMEOUT_MS },
  )
}

export async function proveSessionDiagram(page, fixture: DiagramFixture) {
  await page.evaluate(() => {
    window.location.hash = '#/sessions/prose'
  })
  await page.waitForSelector(`${ACTIVE_VIEWPORT} [data-feed-row]`)
  await fixture.append(fixture.transcripts, DIAGRAM_ROW, DIAGRAM_TEXT)
  await fixture.append(fixture.transcripts, 'p-diagram-after', FOLLOWING_TEXT)
  await waitForDrawnDiagrams(page)

  // The honest state for the fence Mermaid could not draw: its source stays readable and the
  // reader is told plainly, rather than the row going blank.
  const alert = page.locator(`${ACTIVE_VIEWPORT} [role="alert"]`)
  await expect(alert).toHaveText(/incomplete/)
  await expect(
    page
      .locator(`${ACTIVE_VIEWPORT} figure:has-text("Could not render")`)
      .getByRole('button', { name: 'Expand diagram in inspector' }),
  ).toHaveCount(0)

  const expand = page.locator(ACTIVE_VIEWPORT).getByRole('button', {
    name: 'Expand diagram in inspector',
  })
  // Scrolled into view ahead of the reading below, so the click itself causes no scroll: this
  // proof is about opening the inspector holding the anchor, not about the click bringing a
  // row on-screen.
  await expand.scrollIntoViewIfNeeded()
  const before = await rowOffset(page, DIAGRAM_ROW)
  assert.notEqual(before, null)

  await expand.click()
  const inspector = page.locator('[aria-label="Diagram inspector"]')
  await inspector.waitFor()
  await page.waitForFunction(
    () => document.querySelector('[aria-label="Diagram inspector"] svg') !== null,
    undefined,
    { timeout: SETTLE_TIMEOUT_MS },
  )

  assert.equal(Math.abs((await rowOffset(page, DIAGRAM_ROW)) - before) <= 1, true)

  await page.getByRole('button', { name: 'Collapse Session inspector' }).click()
  await page.waitForFunction(
    () =>
      document.querySelector('[aria-label="Session inspector"]')?.getBoundingClientRect().width ===
      0,
  )
  await page.waitForTimeout(REFLOW_SETTLE_MS)
  await page.getByRole('button', { name: 'Open Session inspector' }).click()
  await page.waitForFunction(
    () =>
      (document.querySelector('[aria-label="Session inspector"]')?.getBoundingClientRect().width ??
        0) > 0,
  )
  await page.waitForTimeout(REFLOW_SETTLE_MS)

  assert.equal(Math.abs((await rowOffset(page, DIAGRAM_ROW)) - before) <= 1, true)
  await expect(inspector.locator('svg')).not.toHaveCount(0)
}
