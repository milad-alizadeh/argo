// The live-update half of the packaged Session proof: the reader's chosen row and tail stay put
// while a transcript grows, and a Session opened again starts at its tail.
import assert from 'node:assert/strict'
import {
  ACTIVE_FEED,
  ACTIVE_VIEWPORT,
  offsetOf,
  viewportAnchor,
  waitForRevision,
} from '../feed-selectors'
import { openSession } from './sessionList.case'

type LiveFixture = {
  transcripts: string
  append: (transcripts: string, uuid: string, text: string) => Promise<void>
  stream: (transcripts: string, text: string) => Promise<void>
}

const LIVE_TIMEOUT_MS = 5_000

async function activeRevision(page) {
  return page.evaluate((feed) => document.querySelector(feed)?.dataset.revision, ACTIVE_FEED)
}

async function fixedRow(page) {
  await page.evaluate((selector) => {
    document.querySelector(selector).scrollTop = 0
  }, ACTIVE_VIEWPORT)
  return { ...(await viewportAnchor(page)), revision: await activeRevision(page) }
}

async function tailReading(page) {
  return page.evaluate((selector) => {
    const viewport = document.querySelector(selector)
    return {
      fromTail: viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop,
      hasMeasuredClone: document.querySelector('.feed__measured') !== null,
    }
  }, ACTIVE_VIEWPORT)
}

// The feed is virtualized, so only a row near the viewport is in the DOM; wait for that one.
async function waitForRow(page, uuid) {
  await page.waitForSelector(`${ACTIVE_VIEWPORT} [data-feed-row^="${uuid}:"]`, {
    timeout: LIVE_TIMEOUT_MS,
  })
}

// Row measurements land a frame after the scroll they adjust, so the tail must hold across two frames.
async function waitForTailSettled(page) {
  await page.waitForFunction(
    (selector) =>
      new Promise((resolve) => {
        const distanceFromTail = () => {
          const viewport = document.querySelector(selector)
          return viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop
        }
        const first = distanceFromTail()
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve(first <= 1 && distanceFromTail() <= 1))
        })
      }),
    ACTIVE_VIEWPORT,
    { timeout: LIVE_TIMEOUT_MS },
  )
}

async function proveTail(page, fixture: LiveFixture) {
  await page.evaluate((selector) => {
    const viewport = document.querySelector(selector)
    viewport.scrollTop = viewport.scrollHeight
  }, ACTIVE_VIEWPORT)
  const revision = await activeRevision(page)
  await fixture.stream(fixture.transcripts, 'A streamed result settled while the reader followed.')
  await waitForRevision(page, revision)
  await waitForTailSettled(page)
  const streamed = await tailReading(page)
  assert.equal(streamed.fromTail <= 1, true)
  await fixture.append(
    fixture.transcripts,
    'p-live-2',
    'The second streamed update followed at the tail.',
  )
  await waitForRow(page, 'p-live-2')
  await waitForTailSettled(page)
  const tail = await tailReading(page)
  assert.equal(tail.hasMeasuredClone, false)
  return { tail, streamed }
}

// The virtualizer owns the two reader positions: it follows at the tail and holds the chosen row
// while the reader has moved above it.
export async function proveLiveFeed(page, fixture: LiveFixture) {
  await fixture.stream(
    fixture.transcripts,
    'A streamed result made enough history for the reader to choose a row. '.repeat(48),
  )
  await openSession(page, 'read this file', 'prose')
  await waitForTailSettled(page)
  const before = await fixedRow(page)

  await fixture.stream(
    fixture.transcripts,
    'A streamed result grew this row well above the reader. '.repeat(24),
  )
  await waitForRevision(page, before.revision)
  const streamed = await offsetOf(page, before.anchor)
  assert.equal(Math.abs(streamed - before.offset) <= 1, true)

  const streamedRevision = await activeRevision(page)
  await fixture.append(fixture.transcripts, 'p-live-1', 'The first streamed update arrived.')
  await waitForRevision(page, streamedRevision)
  const held = await offsetOf(page, before.anchor)
  assert.equal(Math.abs(held - before.offset) <= 1, true)

  // An inactive feed is disposed on a switch (#2177), so a Session opened again starts at its tail.
  await openSession(page, 'Refactor the auth module', '11111111-2222-4333-8444-555555555555')
  await openSession(page, 'read this file', 'prose')
  await waitForTailSettled(page)

  const { tail, streamed: streamedTail } = await proveTail(page, fixture)
  return {
    anchoredOffset: held,
    anchoredBefore: before.offset,
    anchoredMotion: streamed - before.offset,
    fromTail: tail.fromTail,
    streamedTailMotion: streamedTail.fromTail,
  }
}
