import { type RefObject, useCallback, useEffect, useState } from 'react'

/** The attribute a feed section wears so the spy can name it. One spelling, so the observer and
 * the markup cannot drift. */
export const SPY_ATTRIBUTE = 'data-spy'

// Where the trip line sits: a hair below the pane's top edge, so the current anchor is the one that has
// just passed out of view — the row you are reading down from.
//
// A FIXED offset near the top rather than a fraction of the pane, because the anchors are feed ROWS as
// well as sections (issue 319) and rows are dense. Any line further down spans several of them, and
// "the last anchor above the line" then skips every anchor sharing the band with a later one — which is
// why a line halfway down could never name the first turn, or any of its first rows.
const LINE_PX = 24

/**
 * Which anchor has most recently crossed the trip line — the one you are reading.
 *
 * The FIRST anchor is the answer while nothing has crossed yet, which is what makes the top of the feed
 * name the turn at the top of the feed.
 *
 * The last screenful is a known limit rather than a special case: the anchors below the line when the
 * feed is bottomed out cannot be lifted to it, because there is no scroll left. They stay reachable by
 * CLICK, which pins the highlight (`pinnedKey`) until the reader scrolls themselves — and an earlier
 * "bottomed out answers with its last anchor" rule is what made the second-to-last row unreachable,
 * since the last screenful collapsed onto one key.
 */
export function activeSection(root: HTMLElement, sections: readonly HTMLElement[]): string | null {
  const keyOf = (section: HTMLElement | undefined): string | null =>
    section?.getAttribute(SPY_ATTRIBUTE) ?? null
  if (sections.length === 0) return null

  const line = root.getBoundingClientRect().top + LINE_PX
  let current = sections[0]
  // Viewport-relative rects rather than `offsetTop`: sections sit inside group wrappers now, so
  // they no longer share an offset parent with the feed and the two are not comparable.
  for (const section of sections) {
    if (section.getBoundingClientRect().top <= line) current = section
  }
  return keyOf(current)
}

/**
 * Which section of a continuous feed is currently in view.
 *
 * The cross-surface interaction model (`cockpit-spec.md` §4.3) makes the left list navigation only
 * and the right detail one continuous feed, so the highlight has to follow the scroll rather than
 * the last click. `keys` is taken as a signature string rather than an array so a caller rebuilding
 * its list every render does not re-observe on every render.
 */
export function useScrollSpy(feed: RefObject<HTMLElement | null>, keys: string): string | null {
  const [active, setActive] = useState<string | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `keys` is this hook's own parameter, which the rule reads as an outer-scope value. It is load-bearing — a changed section list has to be re-measured — so the dependency stays.
  useEffect(() => {
    const root = feed.current
    if (!root) return
    const sections = [...root.querySelectorAll<HTMLElement>(`[${SPY_ATTRIBUTE}]`)]
    if (sections.length === 0) return

    // One measurement per frame at most: a scroll fires far faster than a paint, and every
    // measurement is a layout read.
    let frame = 0
    const measure = (): void => {
      frame = 0
      setActive(activeSection(root, sections))
    }
    const onScroll = (): void => {
      if (frame === 0) frame = requestAnimationFrame(measure)
    }
    measure()
    root.addEventListener('scroll', onScroll, { passive: true })
    // A resize moves every section past the trip line without a scroll event — the pane is a flex
    // child of a splitter, so this fires on a drag as well as on a window resize.
    const observer = new ResizeObserver(onScroll)
    observer.observe(root)
    return () => {
      root.removeEventListener('scroll', onScroll)
      observer.disconnect()
      if (frame !== 0) cancelAnimationFrame(frame)
    }
  }, [feed, keys])

  return active
}

/** The element wearing one anchor. Keys come from transcript data (a tool call's own id), so the value
 * is escaped: a `"` or `]` in one would otherwise throw a `SyntaxError` out of the click handler rather
 * than simply not matching. */
const anchor = (feed: HTMLElement | null, key: string): Element | null =>
  feed?.querySelector(`[${SPY_ATTRIBUTE}="${CSS.escape(key)}"]`) ?? null

const bringIntoView = (element: Element | null): void => {
  element?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/**
 * Smooth-scroll to an anchor — what a click on a nav row does — including one inside a section the
 * feed has not mounted.
 *
 * A virtualised feed stands its distant sections as spacers, so a row anchor genuinely is not in the
 * document until its section is near the viewport — and a jump that silently did nothing would be the
 * navigation list lying about where its rows lead. Reaching the SECTION mounts the rows, and the second
 * pass lands on the one that was asked for: the section's real height replaces its estimate as it
 * mounts, so the first scroll is only ever approximately right.
 */
export function jumpToAnchor(feed: HTMLElement | null, key: string, sectionKey: string): void {
  const target = anchor(feed, key)
  if (target !== null) {
    bringIntoView(target)
    return
  }
  bringIntoView(anchor(feed, sectionKey))
  // Two frames: one for React to mount the section it just scrolled to, one for the browser to lay it
  // out at its real height.
  requestAnimationFrame(() => requestAnimationFrame(() => bringIntoView(anchor(feed, key))))
}

/** Which key the pin names, or `null` once it has been retired.
 *
 * A pin is retired by ARITHMETIC rather than by an effect that resets after a render: it remembers
 * which section list it was set against, so a rebuilt list drops it in the same pass that rebuilt
 * it. A pin outliving the section it names would strand the highlight on a key nothing renders. */
export function pinnedKey(pin: { key: string; keys: string } | null, keys: string): string | null {
  return pin !== null && pin.keys === keys ? pin.key : null
}

// The gestures that mean "I am moving myself now". Deliberately NOT `scroll`: the smooth scroll a
// jump starts fires `scroll` too, and releasing on that would undo the pin the jump just set.
const USER_SCROLL_EVENTS = ['wheel', 'touchmove', 'keydown'] as const

/**
 * The feed's highlight and the jump that moves it — the pair a master–detail surface needs.
 *
 * The highlight follows the SCROLL, except that a click PINS it until the reader scrolls themselves.
 * Both halves are load-bearing. Scroll-following is the interaction model (`cockpit-spec.md` §4.3):
 * the highlight should track what you are looking at, not what you last pressed. But the last screen
 * of a feed cannot be scrolled to the top of its pane — there is no scroll left — so for those
 * sections scroll position alone genuinely cannot say which one you asked for, and a click on the
 * last row would light up a row several above it. The pin makes the click honest without taking the
 * scroll's authority away for the rest of the feed.
 */
export function useFeedHighlight(
  feed: RefObject<HTMLElement | null>,
  {
    keys,
    sectionOf,
  }: {
    /** The anchor list as a signature string, so a caller rebuilding its list every render does not
     * re-observe on every render. */
    keys: string
    /** Which section holds an anchor — the fallback a jump needs when the anchor's section is
     * currently a spacer. */
    sectionOf: (key: string) => string
  },
): { activeKey: string | null; jumpTo: (key: string) => void } {
  const spied = useScrollSpy(feed, keys)
  const [pin, setPin] = useState<{ key: string; keys: string } | null>(null)
  const pinned = pinnedKey(pin, keys)

  useEffect(() => {
    const root = feed.current
    if (!root) return
    const release = (): void => setPin(null)
    for (const type of USER_SCROLL_EVENTS) {
      root.addEventListener(type, release, { passive: true })
    }
    return () => {
      for (const type of USER_SCROLL_EVENTS) root.removeEventListener(type, release)
    }
  }, [feed])

  const jumpTo = useCallback(
    (key: string): void => {
      setPin({ key, keys })
      jumpToAnchor(feed.current, key, sectionOf(key))
    },
    [feed, keys, sectionOf],
  )

  return { activeKey: pinned ?? spied, jumpTo }
}
