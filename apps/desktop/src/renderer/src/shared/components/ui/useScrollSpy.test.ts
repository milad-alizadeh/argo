import { describe, expect, it } from 'vitest'
import { activeSection, SPY_ATTRIBUTE } from './useScrollSpy'

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
  // The trip line sits 45% down a 400px pane, so at 180px.
  const pane = { scrollTop: 0, clientHeight: 400, scrollHeight: 2000 }

  it('names the first section while the feed is at its top', () => {
    const sections = [section('a', 0), section('b', 300), section('c', 600)]
    expect(activeSection(feed(pane), sections)).toBe('a')
  })

  it('names the last section that has crossed the trip line', () => {
    // `b` sits above the 180px line, `c` still below it.
    const sections = [section('a', -400), section('b', 100), section('c', 500)]
    expect(activeSection(feed(pane), sections)).toBe('b')
  })

  // The bug this guard exists for: the sections inside the final viewport-height cannot be lifted to
  // the trip line, so measuring against it alone named a section several rows above the one clicked.
  it('names the LAST section once the feed is scrolled to its end', () => {
    const bottomed = feed({ scrollTop: 1600, clientHeight: 400, scrollHeight: 2000 })
    // Every rect still sits below the line — which is exactly why the line cannot answer here.
    const sections = [section('a', 200), section('b', 300), section('c', 380)]
    expect(activeSection(bottomed, sections)).toBe('c')
  })

  it('tolerates the sub-pixel remainder a fractional device pixel ratio leaves', () => {
    const bottomed = feed({ scrollTop: 1599.6, clientHeight: 400, scrollHeight: 2000 })
    expect(activeSection(bottomed, [section('a', 0), section('z', 900)])).toBe('z')
  })

  it('names nothing when the feed holds no sections', () => {
    expect(activeSection(feed(pane), [])).toBeNull()
  })
})
