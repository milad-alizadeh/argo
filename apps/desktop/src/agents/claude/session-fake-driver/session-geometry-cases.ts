// The geometry half of the packaged Session proof: the measure pass of ADR-0033, the heights it
// hands the Feed, the one row shape whose height is arithmetic, and the cache that keeps a second
// open from measuring again.
import assert from 'node:assert/strict'
// A relative path, not `@/`: `bun build --packages=external` in the version `package.json` pins
// treats every bare specifier as a package, so a `@/` import here leaves the driver bundle asking
// Node for a package named `@/core` and the packaged proof dies before it opens a window.
import { openSession } from '../../../core/sessions/fake-driver/session-roster-cases'

// ADR-0033: every row is laid out in a `content-visibility: hidden` container in the visible
// renderer, and the container itself contributes no height. Both are read off the shipped DOM.
export async function proveGeometry(page) {
  await page.waitForFunction(() => document.querySelectorAll('[data-feed-row]').length > 0)
  const geometry = await page.evaluate(() => {
    const measured = document.querySelector('.feed__measured')
    const rows = [...measured.querySelectorAll('[data-feed-row]')]
    return {
      containerHeight: measured.getBoundingClientRect().height,
      hidden: getComputedStyle(measured).contentVisibility,
      rowHeights: rows.map((row) => row.offsetHeight),
    }
  })
  assert.equal(geometry.hidden, 'hidden')
  assert.equal(geometry.containerHeight, 0)
  assert.equal(
    geometry.rowHeights.every((height) => height > 0),
    true,
  )
  return geometry
}

// A damaged file reads as damaged. Its unreadable lines are drawn as rows, and their height is
// the stated arithmetic rather than a layout the content produced (ADR-0033 rule 1).
export async function proveDamagedSession(page) {
  await openSession(page, 'unparseableBody', 'unparseableBody')
  const rows = await page.evaluate(() =>
    [...document.querySelectorAll('.feed__measured [data-feed-row]')].map((row) => ({
      unreadable: row.classList.contains('feed-row--unreadable'),
      height: row.offsetHeight,
    })),
  )
  // Five damaged lines in a row, drawn as one break in the history rather than five copies of
  // the same sentence (#1907).
  assert.equal(rows.length, 1)
  assert.deepEqual([...new Set(rows.map((row) => row.unreadable))], [true])
  assert.deepEqual([...new Set(rows.map((row) => row.height))], [44])
}

// ADR-0033 · Consequences: the Argo-owned module "supplies every row height". The proof of that
// is on the shipped DOM — every row the Feed draws carries a height of its own, and it is the
// height the pass read for that row, at the width the pass read it at. Rows left to Blink to lay
// out a second time would carry no stated height. The widths are compared for the same reason,
// though on a platform drawing overlay scrollbars they would match either way: the gutter this
// guards against is reserved on both boxes, so the check bites where a scrollbar takes layout
// width and stands as a regression guard where it does not.
// Read off whichever Session is open, so it costs no second measure pass of its own.
export async function proveOwnedHeights(page) {
  const rows = await page.evaluate(() => {
    const boxesIn = (root) =>
      [...document.querySelectorAll(`${root} [data-feed-row]`)].map((row) => {
        const box = row.getBoundingClientRect()
        return {
          id: row.dataset.feedRow,
          height: Math.round(box.height * 100) / 100,
          width: Math.round(box.width * 100) / 100,
          stated: row.style.height,
        }
      })
    return {
      measured: boxesIn('.feed__measured'),
      shown: boxesIn('.feed__viewport'),
      // Rule 6 keys a cached height on the font as well as the width, and the key holds the CSS
      // `font` shorthand. Blink returns `''` for that shorthand wherever it cannot collapse the
      // longhands into one, and a key carrying an empty string invalidates on nothing: every
      // reading would look alike and a font change would hand back heights measured in the old
      // face. Nothing else in this proof would notice, so it is asserted here.
      font: getComputedStyle(document.querySelector('.feed__measured')).font,
    }
  })
  assert.equal(rows.font.length > 0, true)
  assert.equal(rows.shown.length > 0, true)
  assert.equal(
    rows.shown.every((row) => row.stated !== ''),
    true,
  )
  assert.deepEqual(
    rows.shown.map(({ id, height, width }) => ({ id, height, width })),
    rows.measured.map(({ id, height, width }) => ({ id, height, width })),
  )
  return { rows: rows.shown.length }
}

// Rule 4: heights are kept per Session for the launch, so opening a Session already read runs no
// pass at all. A second open that measured again would be the
// caching rule quietly not working.
export async function proveRepeatOpening(page) {
  await openSession(page, 'Pick the ink', 'askPending')
  await openSession(page, 'read this file', 'prose')
  const again = await page.evaluate(() => ({
    measureMs: Number(document.querySelector('.feed').dataset.measureMs),
    settleMs: Number(document.querySelector('.feed').dataset.settleMs),
  }))
  assert.deepEqual(again, { measureMs: 0, settleMs: 0 })
}

// Rule 4 keeps heights for the launch, and a transcript grows while Argo is looking at it. A
// Session read again after its file grew is the same Session at the same width in the same font,
// so a cache keyed on those alone hands back a map that has never heard of the new rows — and a
// row the map has no height for is a row Blink lays out. Measure it, grow the file on disk, leave
// and come back: a Feed read reaches the file every time, so re-opening is the whole of what it
// takes for the new row to arrive, and the height store is the only thing that can be behind.
export async function proveGrownSession(page, transcripts, grow) {
  await openSession(page, 'carry on from where we left it', 'strandedResume')
  const before = await page.evaluate(
    () => document.querySelectorAll('.feed__viewport [data-feed-row]').length,
  )
  await grow(transcripts)
  await openSession(page, 'Refactor the auth module', 'externalBasic')
  await openSession(page, 'carry on from where we left it', 'strandedResume')
  const rows = await page.evaluate(() =>
    [...document.querySelectorAll('.feed__viewport [data-feed-row]')].map((row) => ({
      id: row.dataset.feedRow,
      stated: row.style.height,
    })),
  )
  assert.equal(rows.length, before + 1)
  assert.deepEqual(
    rows.filter((row) => row.stated === ''),
    [],
  )
}
