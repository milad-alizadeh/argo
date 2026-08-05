import { describe, expect, it } from 'vitest'
import { tailSpace } from './useTailSpace'

// Why the feed carries blank space after its last row at all: without it, the rows in the final screenful
// can never be lifted to the scroll-spy's trip line, so the left highlight stuck on whichever row last
// crossed it and the rows below it were unreachable by scrolling (issue 319).

const overflowing = { clientHeight: 400, contentHeight: 2000 }

describe('tailSpace', () => {
  // 400 of pane, less the 24px line, less the 60 the reader still has to scroll past.
  it('is what the last anchor needs to reach the trip line', () => {
    expect(tailSpace({ ...overflowing, belowLast: 60 })).toBe(316)
  })

  // The point of measuring rather than always giving a screenful: blank space is a cost, and a feed
  // ending in something tall — a screenshot, a diff — has already scrolled its last anchor most of the
  // way up by itself.
  it('shrinks to nothing when the last anchor is a screenful tall by itself', () => {
    expect(tailSpace({ ...overflowing, belowLast: 400 })).toBe(0)
  })

  // A feed that does not scroll must not be handed something to scroll through — and it needs none:
  // nothing is below the line to begin with.
  it('is nothing while the rows fit the pane', () => {
    expect(tailSpace({ clientHeight: 400, contentHeight: 300, belowLast: 60 })).toBe(0)
  })

  it('is nothing at the exact height of the pane', () => {
    expect(tailSpace({ clientHeight: 400, contentHeight: 400, belowLast: 60 })).toBe(0)
  })
})
