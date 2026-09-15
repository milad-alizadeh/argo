import assert from 'node:assert/strict'
import { offsetOf, viewportAnchor, waitForRevision } from './feed-selectors'

async function scrollViewport(page) {
  const viewport = page.locator('.feed__document[data-active="true"] .feed__viewport')
  await viewport.hover()
  const before = await page.evaluate(() => document.querySelector('.feed__viewport')?.scrollTop)
  let moving = true
  const motion = (async () => {
    while (moving) {
      await page.mouse.wheel(0, -24)
      await page.waitForTimeout(50)
    }
  })()
  return {
    before,
    stop: async () => {
      moving = false
      await motion
    },
  }
}

// The document remains unchanged while the viewport itself is moving. Once it stops, the next
// settled document starts from the reader's last chosen anchor, not the earlier pre-scroll one.
export async function proveReaderMotion({ page, fixture, outerRevision, visibleRevision }) {
  const motion = await scrollViewport(page)
  try {
    await fixture.stream(
      fixture.transcripts,
      'A second streamed result waited until reader motion stopped. '.repeat(24),
    )
    await waitForRevision(page, outerRevision)
    const heldWhileScrolling = await page.evaluate(
      () => document.querySelector('.feed__viewport')?.dataset.readingRevision,
    )
    assert.equal(heldWhileScrolling, visibleRevision)
    const duringMotion = await page.evaluate(
      () => document.querySelector('.feed__viewport')?.scrollTop,
    )
    assert.notEqual(duringMotion, motion.before)
    await motion.stop()
    const chosen = await viewportAnchor(page)
    await page.waitForFunction((revision) => {
      return document.querySelector('.feed__viewport')?.dataset.readingRevision !== revision
    }, visibleRevision)
    const afterMotion = await offsetOf(page, chosen.anchor)
    assert.equal(Math.abs(afterMotion - chosen.offset) <= 1, true)
    return { anchor: chosen.anchor, motion: afterMotion - chosen.offset, offset: chosen.offset }
  } finally {
    await motion.stop()
  }
}
