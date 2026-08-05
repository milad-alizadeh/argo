import { describe, expect, it } from 'vitest'
import { atEdge, edgeTop, openingAnchor } from './useFeedFollow'

// The auto-follow's two decisions, asserted without a scroller: whether the feed is at the live edge,
// and where a feed opens. Both are the reason the hook is honest — a stick that survived manual
// scrolling would make the feed unusable during exactly the activity it was built for (issue 319).

const pane = (scrollTop: number) => ({ scrollTop, clientHeight: 400, contentHeight: 2000 })

describe('following the live edge', () => {
  it('follows while the feed is scrolled to its bottom', () => {
    expect(atEdge(pane(1600))).toBe(true)
  })

  it('lets go the moment the reader has scrolled up off the edge', () => {
    expect(atEdge(pane(1200))).toBe(false)
  })

  // The slack is what stops a fractional device pixel ratio, or a row settling by a pixel, from reading
  // as the reader having scrolled away.
  it('still follows a few pixels short of the bottom', () => {
    expect(atEdge(pane(1590))).toBe(true)
  })

  it('does not follow a feed the reader has scrolled to the top of', () => {
    expect(atEdge(pane(0))).toBe(false)
  })

  // A feed shorter than its pane has no scroll and is therefore always at its own edge — which is what
  // makes a session's first rows follow before there is anything to scroll.
  it('follows a feed with nothing to scroll', () => {
    expect(atEdge({ scrollTop: 0, clientHeight: 400, contentHeight: 300 })).toBe(true)
  })

  // Past the last row lies the tail space the spy needs (`useTailSpace`) — and that is still the live
  // edge: there is nothing newer to show down there. Measured against the scroller's whole
  // `scrollHeight`, a feed pinned to its newest row would instead read as a screenful adrift, and the
  // reattach affordance would sit there permanently on every live feed.
  it('still follows once the reader has scrolled on into the tail space', () => {
    expect(atEdge(pane(2000))).toBe(true)
  })
})

describe('where the live edge is', () => {
  it('sits the newest row on the floor of the pane', () => {
    expect(edgeTop(pane(0))).toBe(1600)
  })

  it('is the top of a feed with nothing to scroll', () => {
    expect(edgeTop({ scrollTop: 0, clientHeight: 400, contentHeight: 300 })).toBe(0)
  })
})

describe('where a feed opens', () => {
  it('opens a running agent at its live edge', () => {
    expect(openingAnchor(true)).toBe('edge')
  })

  // An ended session opens somewhere sensible rather than mid-feed, and does not attempt to follow: a
  // finished exchange is a document you read from the top.
  it('opens a finished agent at the start', () => {
    expect(openingAnchor(false)).toBe('start')
  })
})
