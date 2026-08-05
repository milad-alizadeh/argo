import { type RefObject, useEffect, useState } from 'react'
import { SPY_ATTRIBUTE, SPY_LINE_PX } from './useScrollSpy'

/** The geometry the tail space is measured from. */
export interface TailMetrics {
  /** The scroller's own height — one screenful. */
  clientHeight: number
  /** The rows' height, the tail space itself excluded. */
  contentHeight: number
  /** How much of the feed lies below the LAST anchor's top edge: that anchor's own height plus anything
   * after it. What the reader still has to scroll past to bring that anchor to the trip line. */
  belowLast: number
}

/**
 * How much blank space the feed carries AFTER its last row, in px.
 *
 * Without it the final screenful of a feed is unreachable by the scroll-spy: its rows cannot be lifted to
 * the trip line near the top of the pane, because there is no scroll left to lift them with — so the
 * highlight stuck on whichever row last crossed the line and the rows below it never became current
 * however far you scrolled (issue 319).
 *
 * The EXACT minimum, not a screenful: just enough that the last anchor can reach the line, so a feed
 * ending in something tall — a screenshot, a diff — carries almost none. Blank space at the end of a feed
 * is a cost, and it is only ever seen by a reader who deliberately scrolls past the newest row (the follow
 * pins to that row, not to the end of the scroll range — see `edgeTop`).
 *
 * ZERO while the rows fit the pane, which is the other half: a feed that does not scroll must not be
 * given something to scroll through, and its rows are all above the line already.
 */
export const tailSpace = ({ clientHeight, contentHeight, belowLast }: TailMetrics): number =>
  contentHeight > clientHeight ? Math.max(0, clientHeight - SPY_LINE_PX - belowLast) : 0

/** The three measurements, read off the live DOM in one pass. */
function measureTail(root: HTMLElement, rows: HTMLElement): TailMetrics {
  const last = [...rows.querySelectorAll<HTMLElement>(`[${SPY_ATTRIBUTE}]`)].at(-1)
  const bottom = rows.getBoundingClientRect().bottom
  return {
    clientHeight: root.clientHeight,
    // The rows' own wrapper rather than the scroller's `scrollHeight`, which counts the tail space this
    // decides — and would feed its own output back in.
    contentHeight: rows.offsetHeight,
    belowLast: last === undefined ? 0 : bottom - last.getBoundingClientRect().top,
  }
}

/**
 * The tail space, re-measured as the pane resizes and the rows grow.
 *
 * Both signals are load-bearing: the size is derived from the pane's height, which a splitter drag
 * changes, and from the last row, which arrives and grows while the reader watches.
 */
export function useTailSpace(
  feed: RefObject<HTMLElement | null>,
  content: RefObject<HTMLElement | null>,
): number {
  const [space, setSpace] = useState(0)

  useEffect(() => {
    const root = feed.current
    const rows = content.current
    if (!root || !rows) return
    const measure = (): void => setSpace(tailSpace(measureTail(root, rows)))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    observer.observe(rows)
    return () => observer.disconnect()
  }, [feed, content])

  return space
}
