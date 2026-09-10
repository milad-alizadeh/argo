// The pane half of the packaged Session proof: the handle between the Roster and the Feed is
// dragged with the pointer, the way a reader drags it, and the Feed measures again at the width
// the drag left it at (ADR-0033 rule 6).
import assert from 'node:assert/strict'

const DRAG = 80

async function widths(page) {
  return page.evaluate(() => ({
    roster: document.querySelector('#roster').getBoundingClientRect().width,
    measured: document.querySelector('.feed__measured').clientWidth,
    shown: document.querySelector('.feed__content').getBoundingClientRect().width,
  }))
}

// Pressed at the handle's centre and moved in steps, so the library sees a drag rather than a
// jump, then released.
async function drag(page, by) {
  const handle = await page.$('[data-slot="resizable-handle"]')
  const box = await handle.boundingBox()
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + by, y, { steps: 8 })
  await page.mouse.up()
}

// The Feed has settled at a width once the rows it shows are drawn at the width it measured.
async function settledAt(page, width) {
  await page.waitForFunction((expected) => {
    const measured = document.querySelector('.feed__measured')
    const shown = document.querySelector('.feed__content')
    return (
      measured !== null &&
      shown !== null &&
      Math.abs(measured.clientWidth - expected) < 1 &&
      Math.abs(shown.getBoundingClientRect().width - expected) < 1
    )
  }, width)
}

export async function provePaneDrag(page) {
  const before = await widths(page)
  assert.equal(Math.abs(before.shown - before.measured) < 1, true)

  await drag(page, DRAG)
  await page.waitForFunction(
    (start) => document.querySelector('#roster').getBoundingClientRect().width > start + 40,
    before.roster,
  )
  const dragged = await widths(page)
  assert.equal(Math.round(dragged.roster - before.roster), DRAG)
  await settledAt(page, before.measured - DRAG)

  // Put the handle back, so no later case reads a Feed at a width it did not ask for.
  await drag(page, -DRAG)
  await settledAt(page, before.measured)
  return { rosterWidth: before.roster, draggedTo: dragged.roster }
}

// A pane scrolls inside itself and never moves the window. Two things escaped before: anything wider
// than its pane, such as a long Session title, grew the deck's column, so the Feed measured wider
// and grew it again, and a visually hidden label in the Roster lined up against the window and
// made the page scroll. Both are put in by hand, so the case does not wait on a fixture to hold them.
export async function proveWindowHoldsStill(page) {
  const reading = await page.evaluate(async () => {
    const column = document.querySelector('.feed__column')
    const before = column.getBoundingClientRect().width
    const wide = document.createElement('div')
    wide.style.width = '6000px'
    wide.style.height = '1px'
    const tall = document.createElement('span')
    tall.className = 'sr-only'
    tall.style.top = '20000px'
    const list = document.querySelector('nav[aria-label="Sessions"]')
    list.append(wide, tall)
    await new Promise((resolve) => setTimeout(resolve, 400))
    const doc = document.scrollingElement
    const after = {
      column: column.getBoundingClientRect().width,
      scrollsDown: doc.scrollHeight > doc.clientHeight,
      scrollsAcross: doc.scrollWidth > doc.clientWidth,
    }
    wide.remove()
    tall.remove()
    return { before, ...after }
  })
  assert.equal(reading.column, reading.before)
  assert.equal(reading.scrollsDown, false)
  assert.equal(reading.scrollsAcross, false)
}
