import { memo, useCallback, useMemo, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Button } from './button'
import { FeedSection, type MasterDetailSection } from './FeedSection'
import { ArrowLineDownIcon } from './icons'
import { openingAnchor, useFeedFollow } from './useFeedFollow'
import { useFeedHighlight } from './useScrollSpy'
import { useTailSpace } from './useTailSpace'

export type { MasterDetailSection } from './FeedSection'

/** The splitter slot: handed the one thing only this component can supply, the nav pane's live
 * width, so a pane that opens at a fraction still resizes from where it actually is. */
export type MasterDetailSplitter = (api: { measure: () => number }) => React.ReactNode

/** What the nav pane is handed so its rows can highlight and jump. The list is navigation only —
 * it never renders detail of its own. */
export interface MasterDetailNav {
  /** The anchor currently in view, tracked by scroll-spy rather than by the last click. */
  activeKey: string | null
  /** Smooth-jump the feed to an anchor. Click still works — it just is not the only way there. */
  jumpTo: (key: string) => void
}

/** Which feed the surface is showing and whether it is still growing — the pair auto-follow needs.
 * `key` is what says "this is a different feed now": switching it stores where the last one was being
 * read and opens the new one at its own edge, because switching feeds is not a scroll. */
export interface MasterDetailFeed {
  key: string
  live: boolean
}

/** Every anchor, in feed order: each section, then the anchors its detail holds. The spy's order and
 * its cache key. */
const anchorList = (sections: readonly MasterDetailSection[]): string[] =>
  sections.flatMap((section) => [section.key, ...(section.anchors ?? [])])

/** Which section holds each anchor, so a jump into an unmounted section can reach the section first. */
function sectionIndex(sections: readonly MasterDetailSection[]): Map<string, string> {
  const owners = new Map<string, string>()
  for (const section of sections) {
    owners.set(section.key, section.key)
    for (const key of section.anchors ?? []) owners.set(key, section.key)
  }
  return owners
}

/** How many sections mount before the intersection observer has reported. A handful, at the end the
 * feed opens on: the observer answers a frame late, so a feed that waited for it would open blank. */
const EAGER_SECTIONS = 3

const isEager = (index: number, count: number, openAt: 'edge' | 'start'): boolean =>
  openAt === 'edge' ? index >= count - EAGER_SECTIONS : index < EAGER_SECTIONS

/**
 * The feed, behind a memo boundary — and the boundary is load-bearing, not an optimisation.
 *
 * The scroll-spy setStates on every animation frame of a scroll, which re-renders this component.
 * `activeKey` is read by the NAV alone, so without this the highlight moving re-rendered every
 * section's detail — diffs, prose, a live terminal — once per frame, and the feed visibly flashed
 * while you scrolled it. `sections` keeps its identity across a spy tick (the tick is this component's
 * own state, not the caller's), so the feed bails out and only the nav re-renders.
 *
 * NOT LOCKED BY A TEST, deliberately: the only honest signal is how many times `FeedSection` runs
 * (measured 651 over a 24-step scroll before this boundary, 0 after), and that is internal to this
 * component — a story can only reach it by counting renders of a `detail` it passes in, which React
 * skips anyway on element identity, so such a test passes with the boundary REMOVED. Verified by
 * hand with a Playwright probe against `sessions-activity--wide-fanout`; re-measure that way if you
 * touch this. A caller that rebuilds `sections` on every one of its own renders defeats the boundary
 * without breaking anything visible, which is the regression to watch for.
 */
const Feed = memo(function Feed({
  sections,
  root,
  openAt,
}: {
  sections: readonly MasterDetailSection[]
  root: React.RefObject<HTMLElement | null>
  /** Which end the feed opens on — the sections mounted before the observer has said anything. */
  openAt: 'edge' | 'start'
}): React.JSX.Element {
  return (
    <>
      {sections.map((section, index) => (
        <FeedSection
          key={section.key}
          section={section}
          root={root}
          eager={isEager(index, sections.length, openAt)}
        />
      ))}
    </>
  )
})

/** The way back to the live edge, shown only while the feed has let go of it. Nothing takes the edge
 * back on the reader's behalf, so this is the whole of how they get there — which is why it floats over
 * the feed rather than living in a header they have scrolled away from. */
function LiveEdgeButton({ onClick }: { onClick: () => void }): React.JSX.Element {
  return (
    <Button
      variant="review-secondary"
      size="sm"
      onClick={onClick}
      className="absolute right-region bottom-region"
    >
      <ArrowLineDownIcon aria-hidden className="icon-sm text-primary" />
      follow the live edge
    </Button>
  )
}

/**
 * Organism: the cockpit's one master–detail feel — a navigation list left, one continuous
 * scrollable feed right.
 *
 * Every list/detail surface in the app shares it (`cockpit-spec.md` §4.3): scrolling the detail
 * flows item to item, a scroll-spy moves the left highlight to whatever anchor is in view, clicking a
 * row smooth-jumps to it, distant sections are virtualised, and a live feed follows its own bottom edge
 * until the reader scrolls up. The nav pane is a render prop because its shape is the caller's —
 * sections, groups, whatever the surface holds — while the highlight, the jump and the follow are this
 * component's.
 */
export function MasterDetail({
  nav,
  sections,
  head,
  feed: feedState,
  splitter,
  navClassName,
  className,
}: {
  /** The navigation pane, handed the active key and the jump so its rows can wire both. */
  nav: (api: MasterDetailNav) => React.ReactNode
  /** The feed, in reading order. */
  sections: readonly MasterDetailSection[]
  /** Pinned above the feed and outside its scroll — whose feed this is, and the way back out of it. */
  head?: React.ReactNode
  /** Which feed this is and whether it is still growing. Omitted where nothing appends. */
  feed?: MasterDetailFeed
  /** The drag handle between the panes. The surface owns which edge it moves, so it passes one in
   * rather than this primitive inventing a layout state of its own — but only this component holds
   * the nav pane, so it hands back the one thing the splitter cannot get for itself: the pane's
   * live width. That is what lets the panes open at `1fr 1fr` and still resize from where they are. */
  splitter?: MasterDetailSplitter
  /** Sizing for the nav pane — the surface owns its width, not this primitive. */
  navClassName?: string
  className?: string
}): React.JSX.Element {
  const feed = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const navPane = useRef<HTMLDivElement>(null)
  const anchors = anchorList(sections).join('|')
  // Memoised on the anchor signature rather than on the array: `sectionOf` is a dependency of the jump,
  // and a new Map every render would give the jump a new identity every render — the same thing the
  // feed's memo boundary above exists to prevent, one level up. The signature IS the section list for
  // this purpose (it is every key, in order), which is why `sections` itself is not a dependency: a
  // caller that rebuilds an identical list must not invalidate the map.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on `anchors`, the signature of `sections` — see above.
  const owners = useMemo(() => sectionIndex(sections), [anchors])
  const sectionOf = useCallback((key: string): string => owners.get(key) ?? key, [owners])
  const { activeKey, jumpTo } = useFeedHighlight(feed, { keys: anchors, sectionOf })
  const tail = useTailSpace(feed, content)
  const { detached, reattach, release } = useFeedFollow(feed, content, {
    live: feedState?.live ?? false,
    agentKey: feedState?.key ?? '',
  })
  // A jump lets go of the live edge FIRST: it is the reader asking to be somewhere else, and a follow
  // still holding the edge would haul the pane back to the bottom while the smooth scroll was still on
  // its way there. Landing on the last row takes the edge back by itself, from the position.
  const jump = useCallback(
    (key: string): void => {
      release()
      jumpTo(key)
    },
    [jumpTo, release],
  )

  return (
    <div className={cn('flex min-h-0 min-w-0 flex-1', className)}>
      <div
        ref={navPane}
        className={cn(
          // `gap-region` between sections against the `gap-tight` inside one: a header sitting the
          // same distance from the list above it as from its own rows attaches to the wrong one.
          'flex min-h-0 min-w-0 flex-col gap-region overflow-y-auto p-inset',
          navClassName ?? 'w-[var(--c-act)] shrink-0',
        )}
      >
        {nav({ activeKey, jumpTo: jump })}
      </div>
      {splitter?.({
        measure: () => navPane.current?.getBoundingClientRect().width ?? 0,
      })}
      {/* The head sits OUTSIDE the scroller, so whose feed you are reading and the way back out of it
          do not scroll away from you. */}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {head}
        <div
          ref={feed}
          data-component="Feed"
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto"
        >
          {/* The content sits in a wrapper of its own so the follow can WATCH its height: rows do not
              only arrive, they grow, and a scroller's own box never changes when they do. Sized by its
              rows — never `flex-1`, which would stretch it to the pane and report one unchanging height
              however much the feed grew. */}
          <div ref={content} className="flex min-w-0 flex-col gap-region p-region">
            <Feed
              sections={sections}
              root={feed}
              openAt={openingAnchor(feedState?.live ?? false)}
            />
          </div>
          {/* One screenful of blank after the last row, so the final rows can be scrolled up to the
              spy's trip line like any others. Sized by measurement rather than by a class, because it
              is one screenful of THIS pane, which a splitter drag changes. */}
          <div aria-hidden className="shrink-0" style={{ height: tail }} />
        </div>
        {detached && <LiveEdgeButton onClick={reattach} />}
      </div>
    </div>
  )
}
