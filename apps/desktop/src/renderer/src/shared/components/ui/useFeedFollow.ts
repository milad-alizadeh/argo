import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

// Auto-follow: a live feed sticks to its bottom edge as rows append, and lets go the moment the reader
// scrolls up. Both halves are the point (issue 319) — a feed you cannot scroll during the activity it
// was built for is worse than one that never followed.
//
// The decisions are pure functions and the DOM work is the hook, so what "following" means is
// falsifiable without a scroller.

/** Where a feed opens.
 *
 * `edge` while the agent is still working: the live edge is where the next row lands, and it is what
 * you opened a running session to watch. `start` once it has finished — a finished exchange is a
 * document you read from the top, and the one thing neither reading may be is the MIDDLE, which is
 * where a scroll offset restored over re-measured rows lands. */
export type FeedOpening = 'edge' | 'start'

export const openingAnchor = (live: boolean): FeedOpening => (live ? 'edge' : 'start')

/** The scroll geometry the follow reads. Taken as plain numbers so the rule below is testable without
 * a scroller. */
export interface ScrollMetrics {
  scrollTop: number
  clientHeight: number
  /** The ROWS' height — deliberately not the scroller's `scrollHeight`, which also counts the screenful
   * of tail space the feed carries so its last rows can reach the scroll-spy's trip line
   * (`useTailSpace`). Measured against that total, a feed pinned to its newest row would read as a
   * screenful short of the edge, forever. */
  contentHeight: number
}

/** How far from the bottom still counts as being AT the bottom, in px. It absorbs the sub-pixel
 * remainder a fractional device pixel ratio leaves behind — which would otherwise read as one pixel
 * short of the edge, forever — and the pixel or two a row's own layout settles by. */
const EDGE_SLACK = 32

/**
 * Whether the feed is following: it is at its bottom edge, where the next row will land.
 *
 * Following is a POSITION, not a remembered gesture. That is what makes "any manual scroll up breaks
 * the follow" hold for every way of scrolling at once — a wheel, a trackpad flick, a drag of the
 * scrollbar, `PageUp`, a jump from the navigation list — rather than for whichever input events a
 * listener happened to enumerate. It is also what keeps a feed that RE-MEASURES under the reader (a
 * virtualised section swapping with its spacer) from reading as a scroll the reader never made.
 */
export const atEdge = ({ scrollTop, clientHeight, contentHeight }: ScrollMetrics): boolean =>
  scrollTop + clientHeight >= contentHeight - EDGE_SLACK

/** Where the newest row sits flush with the bottom of the pane — the live edge as an offset. Past it lies
 * the tail space, which is still the edge: there is nothing newer to show there. */
export const edgeTop = ({ clientHeight, contentHeight }: ScrollMetrics): number =>
  Math.max(0, contentHeight - clientHeight)

const metricsOf = (root: HTMLElement, rows: HTMLElement): ScrollMetrics => ({
  scrollTop: root.scrollTop,
  clientHeight: root.clientHeight,
  contentHeight: rows.offsetHeight,
})

/** One agent's reading position, remembered so switching away and back is not a scroll to nowhere. */
interface Reading {
  top: number
  following: boolean
}

/** What the surface gets back: whether it has let go of the live edge, and the way to take it again. */
export interface FeedFollow {
  /** The feed is live and NOT at its edge — the only state the reattach affordance appears in, since
   * there is nothing to reattach to on a feed that has stopped growing. */
  detached: boolean
  /** Take the live edge again. Explicit, because nothing takes it back on the reader's behalf: a feed
   * that re-attached by itself would fight them on the next append. */
  reattach: () => void
  /** Let go of the edge NOW, before a scroll the surface is about to perform on the reader's behalf.
   *
   * A jump from the navigation list is the reader asking to be somewhere else, and a smooth scroll takes
   * several frames to get there — long enough for a section mounting on the way to grow the content while
   * the feed is still, by position, at its edge. Without this the follow would haul the pane back to the
   * bottom mid-jump, which is the follow fighting the one gesture it must never fight. */
  release: () => void
}

/**
 * One agent's reading position, stored on the way out and restored on the way in.
 *
 * Switching agents is NOT a scroll, which is the whole reason this is separate from the position-derived
 * follow below: the incoming feed's offset has to be set rather than read, and an agent seen for the first
 * time opens at its own opening anchor rather than at wherever the last one was being read.
 *
 * Layout-timed, so the restored offset is applied against the new agent's rows and never painted at the
 * old agent's position first.
 */
function useAgentMemory({
  feed,
  content,
  agentKey,
  live,
  following,
  jumping,
  setFollowing,
}: {
  feed: RefObject<HTMLElement | null>
  content: RefObject<HTMLElement | null>
  agentKey: string
  live: boolean
  following: RefObject<boolean>
  jumping: RefObject<boolean>
  setFollowing: (next: boolean) => void
}): void {
  const reading = useRef(new Map<string, Reading>())
  const shown = useRef<string | null>(null)

  useLayoutEffect(() => {
    const root = feed.current
    const rows = content.current
    const leaving = shown.current
    if (!root || !rows || leaving === agentKey) return
    if (leaving !== null) {
      reading.current.set(leaving, { top: root.scrollTop, following: following.current })
    }
    shown.current = agentKey
    const remembered = reading.current.get(agentKey)
    const opensAtEdge = remembered === undefined && openingAnchor(live) === 'edge'
    jumping.current = false
    setFollowing(remembered?.following ?? opensAtEdge)
    root.scrollTop = opensAtEdge ? edgeTop(metricsOf(root, rows)) : (remembered?.top ?? 0)
  })
}

/**
 * The live edge and the reader's place in it, per agent.
 *
 * `agentKey` is what makes the memory honest: switching agents is not a scroll, so the outgoing agent's
 * offset and follow state are stored and the incoming one's are restored — and an agent seen for the
 * first time opens at its OWN opening anchor rather than at wherever the last one was being read.
 *
 * The append signal is the CONTENT's own height, watched rather than derived: rows do not only arrive,
 * they GROW — a streaming message and a widening quiet fold both extend the feed without adding a row
 * or changing a key, so any signature built from the row list would miss exactly the case the follow
 * exists for.
 */
export function useFeedFollow(
  feed: RefObject<HTMLElement | null>,
  content: RefObject<HTMLElement | null>,
  { live, agentKey }: { live: boolean; agentKey: string },
): FeedFollow {
  // A REF is the state, mirrored into React state for the affordance to render off. The growth observer
  // and the scroll listener both read it in the same tick a click writes it, and a re-render is a tick
  // too late: the correction would fire against the value from before the reader let go.
  const following = useRef(openingAnchor(live) === 'edge')
  const [detached, setDetached] = useState(!following.current)
  const setFollowing = useCallback((next: boolean): void => {
    following.current = next
    setDetached(!next)
  }, [])
  // A jump is in flight. Its smooth scroll starts AT the edge and takes several frames to leave it, so
  // the position says "following" for the first of them — and re-deriving from that would let the growth
  // observer haul the pane back to the bottom, cancelling the jump. Cleared the moment the position has
  // actually left the edge, which is when position is telling the truth again.
  const jumping = useRef(false)

  const toEdge = useCallback((): void => {
    const root = feed.current
    const rows = content.current
    if (!root || !rows) return
    const top = edgeTop(metricsOf(root, rows))
    // Never BACKWARDS: a reader who has scrolled down into the tail space to read the last rows is already
    // at the live edge, and an append must not haul them back up to sit the newest row on the pane's floor.
    if (root.scrollTop < top) root.scrollTop = top
  }, [feed, content])

  useAgentMemory({ feed, content, agentKey, live, following, jumping, setFollowing })

  // The position IS the state: every scroll re-reads whether the feed is at its edge, so the reader
  // scrolling up lets go and the reader scrolling back down takes it again — which is not the follow
  // reattaching itself, it is the reader doing it by hand.
  useEffect(() => {
    const root = feed.current
    const rows = content.current
    if (!root || !rows) return
    const onScroll = (): void => {
      const here = atEdge(metricsOf(root, rows))
      if (jumping.current) {
        if (!here) jumping.current = false
        return
      }
      setFollowing(here)
    }
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => root.removeEventListener('scroll', onScroll)
  }, [feed, content, setFollowing])

  // The append: a following feed goes to the new bottom whenever the content grows. A feed that is not
  // live has nothing to follow and is left exactly where the reader put it.
  useEffect(() => {
    const element = content.current
    if (!element || !live) return
    const observer = new ResizeObserver(() => {
      if (following.current) toEdge()
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [content, live, toEdge])

  return {
    detached: live && detached,
    reattach: useCallback((): void => {
      jumping.current = false
      setFollowing(true)
      toEdge()
    }, [setFollowing, toEdge]),
    release: useCallback((): void => {
      jumping.current = true
      setFollowing(false)
    }, [setFollowing]),
  }
}
