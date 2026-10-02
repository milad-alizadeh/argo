// The live-update half of the packaged Session proof: the reader's chosen row and tail stay put
// while a transcript grows and a row above them shrinks (#2960).
import { expect } from '@playwright/test'
import {
  ACTIVE_FEED,
  ACTIVE_VIEWPORT,
  offsetOf,
  viewportAnchor,
  waitForRevision,
} from '../feed-selectors'
import { fixtureSession } from '../fixture-sessions'
import { openSession } from './session-list.case'

// Each write reaches the open Feed the way an outside Session's does: transcript, then hook.
type LiveFixture = {
  append: (uuid: string, text: string) => Promise<void>
  stream: (text: string) => Promise<void>
}

const LIVE_TIMEOUT_MS = 5_000
// Past either end of any Feed here, so one wheel turn reaches it.
const WHOLE_FEED_PX = 100_000

async function activeRevision(page) {
  return page.evaluate((feed) => document.querySelector(feed)?.dataset.revision, ACTIVE_FEED)
}

// The reader's own gesture, over the Feed, through the input pipeline.
async function wheel(page, deltaY: number) {
  const box = await page.locator(ACTIVE_VIEWPORT).boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.wheel(0, deltaY)
}

// Two frames apart, so a row measured a frame after a scroll counts; `page.evaluate` awaits the
// promise, where `waitForFunction` would take it as truthy at once.
async function settledDistance(page, edge: 'top' | 'tail') {
  return page.evaluate(
    ({ selector, edge }) =>
      new Promise<number>((resolve) => {
        const distance = () => {
          const viewport = document.querySelector(selector)
          return edge === 'top'
            ? viewport.scrollTop
            : viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop
        }
        const first = distance()
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve(Math.max(first, distance())))
        })
      }),
    { selector: ACTIVE_VIEWPORT, edge },
  )
}

async function waitForSettled(page, edge: 'top' | 'tail') {
  await expect
    .poll(() => settledDistance(page, edge), {
      message: `px from the ${edge}`,
      timeout: LIVE_TIMEOUT_MS,
    })
    .toBeLessThanOrEqual(1)
}

async function fixedRow(page) {
  await wheel(page, -WHOLE_FEED_PX)
  await waitForSettled(page, 'top')
  return { ...(await viewportAnchor(page)), revision: await activeRevision(page) }
}

async function hasMeasuredClone(page) {
  return page.evaluate(() => document.querySelector('.feed__measured') !== null)
}

// The feed is virtualized, so only a row near the viewport is in the DOM; wait for that one.
async function waitForRow(page, uuid) {
  await page.waitForSelector(`${ACTIVE_VIEWPORT} [data-feed-row="${uuid}"]`, {
    timeout: LIVE_TIMEOUT_MS,
  })
}

async function proveTail(page, fixture: LiveFixture) {
  await wheel(page, WHOLE_FEED_PX)
  await waitForSettled(page, 'tail')
  const revision = await activeRevision(page)
  // The row the first stream grew, far above the reader, shrinks to one line.
  await fixture.stream('A streamed result settled while the reader followed.')
  await waitForRevision(page, revision)
  await waitForSettled(page, 'tail')
  await fixture.append('p-live-2', 'The second streamed update followed at the tail.')
  await waitForRow(page, 'p-live-2')
  await waitForSettled(page, 'tail')
  expect(await hasMeasuredClone(page)).toBe(false)
}

// The virtualizer owns the two reader positions: it follows at the tail and holds the chosen row
// while the reader has moved above it.
export async function proveLiveFeed(page, fixture: LiveFixture) {
  await fixture.stream(
    'A streamed result made enough history for the reader to choose a row. '.repeat(200),
  )
  const prose = await fixtureSession('prose')
  await openSession(page, 'read this file', prose)
  await waitForSettled(page, 'tail')
  const before = await fixedRow(page)

  await fixture.stream('A streamed result grew this row well above the reader. '.repeat(400))
  await waitForRevision(page, before.revision)
  const streamed = await offsetOf(page, before.anchor)
  expect(Math.abs(streamed - before.offset), `moved from ${before.offset}px`).toBeLessThanOrEqual(1)

  const streamedRevision = await activeRevision(page)
  await fixture.append('p-live-1', 'The first streamed update arrived. '.repeat(200))
  await waitForRevision(page, streamedRevision)
  const held = await offsetOf(page, before.anchor)
  expect(Math.abs(held - before.offset), `moved from ${before.offset}px`).toBeLessThanOrEqual(1)

  // A Session opened again is a fresh mount that keeps the reader's place.
  await openSession(
    page,
    'Refactor the auth module',
    await fixtureSession('11111111-2222-4333-8444-555555555555'),
  )
  await openSession(page, 'read this file', prose)
  await proveTail(page, fixture)

  await wheel(page, -WHOLE_FEED_PX)
  const jumpToLatest = page.getByRole('button', { name: 'Jump to latest' })
  await expect(jumpToLatest).toBeVisible()
  await jumpToLatest.click()
  await waitForSettled(page, 'tail')
}
