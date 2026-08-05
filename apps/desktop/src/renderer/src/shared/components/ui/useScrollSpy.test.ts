import { describe, expect, it } from 'vitest'
import { activeSection, pinnedKey, SPY_ATTRIBUTE } from './useScrollSpy'

// The DOM geometry the spy reads, stubbed as plain numbers: jsdom lays nothing out, so a real
// element would report every rect as zero and the arithmetic under test would never run.
function feed({
  scrollTop,
  clientHeight,
  scrollHeight,
}: {
  scrollTop: number
  clientHeight: number
  scrollHeight: number
}): HTMLElement {
  return {
    scrollTop,
    clientHeight,
    scrollHeight,
    getBoundingClientRect: () => ({ top: 0 }) as DOMRect,
  } as unknown as HTMLElement
}

/** A section at `top` viewport-relative px, named `key`. */
function section(key: string, top: number): HTMLElement {
  return {
    getBoundingClientRect: () => ({ top }) as DOMRect,
    getAttribute: (name: string) => (name === SPY_ATTRIBUTE ? key : null),
  } as unknown as HTMLElement
}

describe('activeSection', () => {
  // The trip line sits 24px below the pane's top edge.
  const pane = { scrollTop: 0, clientHeight: 400, scrollHeight: 2000 }

  it('names the first section while the feed is at its top', () => {
    const sections = [section('a', 24), section('b', 300), section('c', 600)]
    expect(activeSection(feed(pane), sections)).toBe('a')
  })

  // The FIRST anchor answers even before anything has crossed — the top of the feed names the turn at
  // the top of the feed, which is what a line halfway down the pane could never do.
  it('names the first section while nothing has crossed the line yet', () => {
    const sections = [section('a', 60), section('b', 400)]
    expect(activeSection(feed(pane), sections)).toBe('a')
  })

  it('names the last section that has crossed the trip line', () => {
    // `b` sits above the 24px line, `c` still below it.
    const sections = [section('a', -400), section('b', 10), section('c', 500)]
    expect(activeSection(feed(pane), sections)).toBe('b')
  })

  // The regression this replaced: a bottomed-out feed used to answer with its LAST anchor whatever the
  // geometry said, which collapsed the whole final screenful onto one key — so the second-to-last row
  // could never be current, however slowly you scrolled. The line answers here like anywhere else, and
  // the rows below it stay reachable by click, which pins.
  it('keeps answering from the line once the feed is scrolled to its end', () => {
    const bottomed = feed({ scrollTop: 1600, clientHeight: 400, scrollHeight: 2000 })
    const sections = [section('a', -20), section('b', 10), section('c', 380)]
    expect(activeSection(bottomed, sections)).toBe('b')
  })

  it('names nothing when the feed holds no sections', () => {
    expect(activeSection(feed(pane), [])).toBeNull()
  })
})

// The pin is the other half of the fix: scroll position genuinely cannot say which of the last
// sections was clicked, so a click holds the highlight until the reader scrolls themselves.
describe('pinnedKey', () => {
  const keys = 'a|b|c'

  it('names nothing while no click has pinned one', () => {
    expect(pinnedKey(null, keys)).toBeNull()
  })

  it('names the clicked section while the list it was clicked in still stands', () => {
    expect(pinnedKey({ key: 'c', keys }, keys)).toBe('c')
  })

  // Retirement by arithmetic rather than by an effect that resets after a render: a pin outliving
  // the section it names would strand the highlight on a key nothing renders.
  it('retires the pin the moment the section list changes', () => {
    expect(pinnedKey({ key: 'c', keys }, 'a|b')).toBeNull()
  })

  it('retires it even when the key it names still exists in the new list', () => {
    expect(pinnedKey({ key: 'a', keys }, 'a|b')).toBeNull()
  })
})
