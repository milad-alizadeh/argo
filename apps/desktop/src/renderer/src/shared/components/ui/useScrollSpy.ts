import { type RefObject, useCallback, useEffect, useState } from 'react'

/** The attribute a feed section wears so the spy can name it. One spelling, so the observer and
 * the markup cannot drift. */
export const SPY_ATTRIBUTE = 'data-spy'

// Where the trip line sits: a section counts as current once its top reaches the top band of the
// feed, not when it first peeks in from below.
const BAND_RATIO = 0.45

/** Which section has most recently crossed the trip line — the one you are looking at.
 *
 * A BOTTOMED-OUT feed answers with its last section, unconditionally. This is not a nicety: the
 * sections inside the final viewport-height can never reach a trip line that sits 45% down the pane,
 * because there is no scroll left to lift them there. An earlier implementation observed
 * intersections against that band and so could never name the tail at all — clicking the last row
 * scrolled to it and then highlighted the first row still crossing the line, several items above.
 */
export function activeSection(root: HTMLElement, sections: readonly HTMLElement[]): string | null {
  const keyOf = (section: HTMLElement | undefined): string | null =>
    section?.getAttribute(SPY_ATTRIBUTE) ?? null
  if (sections.length === 0) return null
  // `- 1` absorbs the sub-pixel remainder a fractional device pixel ratio leaves behind.
  if (root.scrollTop + root.clientHeight >= root.scrollHeight - 1) return keyOf(sections.at(-1))

  const line = root.getBoundingClientRect().top + root.clientHeight * BAND_RATIO
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

/** Smooth-scroll a feed section to the top of its pane — what a click on a nav row does. Keys come
 * from transcript data (a tool call's own id), so the value is escaped: a `"` or `]` in one would
 * otherwise throw a `SyntaxError` out of the click handler rather than simply not matching. */
export function jumpToSection(feed: HTMLElement | null, key: string): void {
  const section = feed?.querySelector(`[${SPY_ATTRIBUTE}="${CSS.escape(key)}"]`)
  section?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
  keys: string,
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
      jumpToSection(feed.current, key)
    },
    [feed, keys],
  )

  return { activeKey: pinned ?? spied, jumpTo }
}
