import { type RefObject, useEffect, useState } from 'react'

/** The attribute a feed section wears so the spy can name it. One spelling, so the observer and
 * the markup cannot drift. */
export const SPY_ATTRIBUTE = 'data-spy'

// Whichever observed section sits highest in the feed is the one in view. Reading `offsetTop`
// rather than the intersection ratio is what makes a tall section that fills the viewport win
// over a short one entering below it.
function topmost(visible: Set<Element>): string | null {
  const sorted = [...visible].sort(
    (a, b) => (a as HTMLElement).offsetTop - (b as HTMLElement).offsetTop,
  )
  return sorted[0]?.getAttribute(SPY_ATTRIBUTE) ?? null
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: `keys` is this hook's own parameter, which the rule reads as an outer-scope value. It is load-bearing — a changed section list has to be re-observed — so the dependency stays.
  useEffect(() => {
    const root = feed.current
    if (!root) return
    const sections = root.querySelectorAll(`[${SPY_ATTRIBUTE}]`)
    if (sections.length === 0) return

    const visible = new Set<Element>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target)
          else visible.delete(entry.target)
        }
        if (visible.size > 0) setActive(topmost(visible))
      },
      // The bottom margin pulls the trip line up to the top band of the feed: a section counts as
      // current once its heading reaches the top, not when it first peeks in from below.
      { root, rootMargin: '0px 0px -55% 0px', threshold: [0, 1] },
    )
    for (const section of sections) observer.observe(section)
    return () => observer.disconnect()
  }, [feed, keys])

  return active
}

/** Smooth-scroll a feed section to the top of its pane — what a click on a nav row does. */
export function jumpToSection(feed: HTMLElement | null, key: string): void {
  const section = feed?.querySelector(`[${SPY_ATTRIBUTE}="${key}"]`)
  section?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
