// The first-screen accessibility acceptance (#1784, #1785, #1786), asserted on the packaged
// cockpit. Keys are dispatched into the renderer over the debugging protocol, so the run never
// takes the real keyboard.
import assert from 'node:assert/strict'
import { deckState, waitForDeck } from './cockpit-driver.mjs'

// A bound on the walk, so a ring that never closes fails as a count rather than as a hang.
const TAB_LIMIT = 24
const EXPECTED_CONTROLS = 7

export async function proveNames(page) {
  const unnamed = await page.evaluate(() =>
    [...document.querySelectorAll('button')]
      .filter(
        (control) => !(control.getAttribute('aria-label') ?? control.textContent ?? '').trim(),
      )
      .map((control) => control.outerHTML),
  )
  assert.deepEqual(unnamed, [])
  assert.equal(
    await page.getAttribute('[data-component="AppearanceControl"]', 'aria-label'),
    'Appearance',
  )
  assert.equal(await page.getAttribute('[data-component="Sidebar"]', 'aria-label'), 'Surfaces')
  assert.equal(
    await page.textContent('[data-component="NavigationRow"][aria-current="page"]'),
    'Projects',
  )
}

// How a control is named in a reading, and what its ring looks like right now. The key has to be
// derived the same way in both readings below, or the resting shape and the focused one would be
// compared across two different controls.
const READING = `(control) => {
  const style = getComputedStyle(control)
  const name = (control.getAttribute('aria-label') ?? control.textContent ?? '').trim()
  return {
    key: (control.getAttribute('data-component') ?? control.tagName.toLowerCase()) + ':' + name,
    name,
    ring: style.boxShadow + '|' + style.outlineStyle + '|' + style.outlineWidth,
  }
}`

// Every control as it looks with the keyboard nowhere near it. A ring assertion that only reads
// the focused control passes on a component that draws the same shadow all the time.
function restingRings(page) {
  return page.evaluate(`(() => {
    const read = ${READING}
    return Object.fromEntries([...document.querySelectorAll('button')].map((control) => {
      const reading = read(control)
      return [reading.key, reading.ring]
    }))
  })()`)
}

// What the keyboard cursor looks like where it is standing now, or null when it left the page.
function focused(page) {
  return page.evaluate(`(() => {
    const active = document.activeElement
    if (!active || active === document.body) return null
    const read = ${READING}
    return { ...read(active), focusVisible: active.matches(':focus-visible') }
  })()`)
}

// Every control the first screen puts in the tab ring, not the first one alone: a component that
// removes the outline and draws nothing back is invisible to a keyboard, and only the control it
// happens to sit on would report it. The walk ends where Tab returns to a control it already
// visited, which is what makes the ring a ring rather than a list.
export async function proveFocusRing(page) {
  const resting = await restingRings(page)
  const visited = []
  let closed = false
  for (let step = 0; step < TAB_LIMIT && !closed; step += 1) {
    await page.keyboard.press('Tab')
    const focus = await focused(page)
    closed = focus === null || visited.some((entry) => entry.key === focus.key)
    if (closed) break
    assert.equal(focus.focusVisible, true, `${focus.key} does not match :focus-visible`)
    assert.notEqual(focus.ring, resting[focus.key], `${focus.key} draws no ring of its own`)
    assert.notEqual(focus.name, '', `${focus.key} has no accessible name`)
    visited.push(focus)
  }
  assert.equal(closed, true, `the tab ring did not close inside ${TAB_LIMIT} presses`)
  // The first screen is an appearance control, five navigation rows and the deck's own button.
  assert.equal(visited.length >= EXPECTED_CONTROLS, true, `only ${visited.length} controls tabbed`)
  return visited.map((entry) => entry.key)
}

// Every window-scope chord in the table, not a sample of it: a destination nobody presses is a
// destination whose chord can be wrong for as long as nobody notices.
const NAVIGATION = [
  ['Meta+2', 'sessions'],
  ['Meta+3', 'tickets'],
  ['Meta+4', 'atlas'],
  ['Meta+5', 'code'],
]

export async function proveShortcuts(page) {
  const selected = await deckState(page)
  for (const [chord, destination] of NAVIGATION) {
    await page.keyboard.press(chord)
    await waitForDeck(page, destination)
  }
  await page.keyboard.press('Meta+1')
  await waitForDeck(page, selected)
}
