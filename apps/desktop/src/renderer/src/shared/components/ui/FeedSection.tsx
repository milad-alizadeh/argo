import { type RefObject, useRef } from 'react'
import { useNearViewport } from './useNearViewport'
import { SPY_ATTRIBUTE } from './useScrollSpy'

/** One item of a master–detail surface: the key that ties its nav row to its section of the feed, the
 * detail the feed renders for it, and the anchors that detail hangs INSIDE itself. */
export interface MasterDetailSection {
  key: string
  detail: React.ReactNode
  /** The keys of anchors within this section's detail — a feed row worth jumping to. They are the
   * section's rather than the caller's business only in one respect: a jump to an anchor whose section
   * is currently a spacer has to reach the section first, and this is what says which section that is. */
  anchors?: readonly string[]
}

/**
 * One section: the spy's anchor, the jump's target, and the unit the feed virtualises by.
 *
 * A hairline separates neighbours — one continuous feed still has to say where an item ends, or a
 * scroll through thirty of them reads as one long list.
 *
 * Far from the viewport it stands as a SPACER of the height its rows last measured, and keeps its
 * anchor while doing so: an occluded section is still a place the navigation list can jump to, which is
 * what lets the window be invisible to everything else on the surface.
 */
export function FeedSection({
  section,
  root,
  eager,
}: {
  section: MasterDetailSection
  /** The scrolling pane, which is the window the section measures itself against. */
  root: RefObject<HTMLElement | null>
  /** Mount before the observer reports — for the sections the feed opens on. */
  eager?: boolean
}): React.JSX.Element {
  const ref = useRef<HTMLElement>(null)
  const { mounted, height } = useNearViewport(ref, root, eager)
  return (
    <section
      ref={ref}
      style={height === undefined ? undefined : { height }}
      className="border-t border-t-inset-hair pt-region first:border-t-0 first:pt-0"
      {...{ [SPY_ATTRIBUTE]: section.key }}
    >
      {mounted && section.detail}
    </section>
  )
}
