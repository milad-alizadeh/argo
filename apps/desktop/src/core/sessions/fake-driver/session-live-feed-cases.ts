// The live-update half of the packaged Session proof: the reader's chosen row and tail stay put
// while a transcript grows, and a kept Session returns without a remounted scroller.
import assert from 'node:assert/strict'
import { openSession } from './session-roster-cases'

type LiveFixture = {
  transcripts: string
  append: (transcripts: string, uuid: string, text: string) => Promise<void>
  stream: (transcripts: string, text: string) => Promise<void>
}

const LIVE_REVISION_TIMEOUT_MS = 5_000

async function fixedRow(page) {
  return page.evaluate(() => {
    const viewport = document.querySelector('.feed__viewport')
    viewport.scrollTop = viewport.scrollHeight / 2
    const row = [...viewport.querySelectorAll('[data-feed-row]')].find(
      (candidate) =>
        candidate.getBoundingClientRect().bottom > viewport.getBoundingClientRect().top,
    )
    return {
      rows: viewport.querySelectorAll('[data-feed-row]').length,
      anchor: row.dataset.feedRow,
      offset: row.getBoundingClientRect().top - viewport.getBoundingClientRect().top,
      revision: document.querySelector('.feed__document[data-active="true"]').dataset.revision,
    }
  })
}

async function offsetOf(page, anchor) {
  return page.evaluate((id) => {
    const viewport = document.querySelector('.feed__viewport')
    const row = viewport.querySelector(`[data-feed-row="${id}"]`)
    return row.getBoundingClientRect().top - viewport.getBoundingClientRect().top
  }, anchor)
}

async function waitForRevision(page, previous) {
  await page.waitForFunction(
    (revision) => {
      return (
        document.querySelector('.feed__document[data-active="true"]')?.dataset.revision !== revision
      )
    },
    previous,
    { timeout: LIVE_REVISION_TIMEOUT_MS },
  )
}

async function tailReading(page) {
  return page.evaluate(() => {
    const viewport = document.querySelector('.feed__viewport')
    return {
      fromTail: viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop,
      unstated: [...viewport.querySelectorAll('[data-feed-row]')].filter(
        (row) => row.style.height === '',
      ).length,
    }
  })
}

async function waitForRowCount(page, count) {
  await page.waitForFunction(
    (expected) =>
      document.querySelectorAll(
        '.feed__document[data-active="true"] .feed__viewport [data-feed-row]',
      ).length === expected,
    count,
    { timeout: LIVE_REVISION_TIMEOUT_MS },
  )
}

async function proveTail(page, fixture: LiveFixture, before) {
  await page.evaluate(() => {
    const viewport = document.querySelector('.feed__viewport')
    viewport.scrollTop = viewport.scrollHeight
  })
  const revision = await page.evaluate(
    () => document.querySelector('.feed__document[data-active="true"]')?.dataset.revision,
  )
  await fixture.stream(fixture.transcripts, 'A streamed result settled while the reader followed.')
  await waitForRevision(page, revision)
  const streamed = await tailReading(page)
  assert.equal(streamed.fromTail <= 1, true)
  await fixture.append(
    fixture.transcripts,
    'p-live-2',
    'The second streamed update followed at the tail.',
  )
  await waitForRowCount(page, before.rows + 2)
  const tail = await tailReading(page)
  assert.equal(tail.fromTail <= 1, true)
  assert.equal(tail.unstated, 0)
  return { tail, streamed }
}

// ADR-0033 rule 5: an appended row is measured before it enters the viewport. The scroller owns
// the two reader positions: it follows while at the tail and holds the chosen row while the
// reader has moved above it. The second half also proves that a kept Session is not remounted on
// a switch, which would reset its chosen row to the tail.
export async function proveLiveFeed(page, fixture: LiveFixture) {
  await fixture.stream(
    fixture.transcripts,
    'A streamed result made enough history for the reader to choose a row. '.repeat(48),
  )
  await openSession(page, 'read this file', 'prose')
  const opened = await tailReading(page)
  assert.equal(opened.fromTail <= 1, true)
  const before = await fixedRow(page)

  await fixture.stream(
    fixture.transcripts,
    'A streamed result grew this row well above the reader. '.repeat(24),
  )
  await waitForRevision(page, before.revision)
  const streamed = await offsetOf(page, before.anchor)
  assert.equal(Math.abs(streamed - before.offset) <= 1, true)

  await fixture.append(fixture.transcripts, 'p-live-1', 'The first streamed update arrived.')
  await waitForRowCount(page, before.rows + 1)
  const held = await offsetOf(page, before.anchor)
  assert.equal(Math.abs(held - before.offset) <= 1, true)

  await openSession(page, 'Refactor the auth module', 'externalBasic')
  await openSession(page, 'read this file', 'prose')
  const kept = await offsetOf(page, before.anchor)
  assert.equal(Math.abs(kept - before.offset) <= 1, true)

  const { tail, streamed: streamedTail } = await proveTail(page, fixture, before)
  return {
    anchoredOffset: held,
    anchoredBefore: before.offset,
    anchoredMotion: streamed - before.offset,
    fromTail: tail.fromTail,
    keptMotion: kept - before.offset,
    streamedTailMotion: streamedTail.fromTail,
  }
}
