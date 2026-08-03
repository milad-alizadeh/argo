import { useRef } from 'react'
import { cn } from '@/lib/utils'
import { SectionHeader } from './SectionHeader'
import { SPY_ATTRIBUTE, useFeedHighlight } from './useScrollSpy'

/** One item of the surface: the key that ties its nav row to its section of the feed, and the
 * detail the feed renders for it. */
export interface MasterDetailSection {
  key: string
  detail: React.ReactNode
}

/** A run of sections that belong to ONE owner.
 *
 * The feed is a concatenation, so without this every section reads as a sibling of every other —
 * which is exactly how a delegate's work gets mistaken for the surface's own. A group heads its run
 * and, where the work is somebody else's, indents it onto its own spine: the root axis is the
 * subject's work, an indented spine is a delegate's. That is ownership carried structurally, rather
 * than by a heading the reader scrolled past.
 */
export interface MasterDetailGroup {
  key: string
  /** The heading over the run. `null` is the root group — the subject's own work, headed by
   * nothing, because a surface does not announce itself inside itself. */
  label: string | null
  count?: string
  /** Indent onto a spine of its own. Set where the run is somebody else's work. */
  nested?: boolean
  sections: readonly MasterDetailSection[]
}

/** The splitter slot: handed the one thing only this component can supply, the nav pane's live
 * width, so a pane that opens at a fraction still resizes from where it actually is. */
export type MasterDetailSplitter = (api: { measure: () => number }) => React.ReactNode

/** What the nav pane is handed so its rows can highlight and jump. The list is navigation only —
 * it never renders detail of its own. */
export interface MasterDetailNav {
  /** The section currently in view, tracked by scroll-spy rather than by the last click. */
  activeKey: string | null
  /** Smooth-jump the feed to a section. Click still works — it just is not the only way there. */
  jumpTo: (key: string) => void
}

/** The spy's order and its cache key: every section of every group, in feed order. */
const feedKeys = (groups: readonly MasterDetailGroup[]): string[] =>
  groups.flatMap((group) => group.sections.map((section) => section.key))

/** One section: the spy's anchor and the jump's target. The caller owns everything inside it. A
 * hairline separates neighbours — one continuous feed still has to say where an item ends, or a
 * scroll through thirty of them reads as one long list. */
function FeedSection({ section }: { section: MasterDetailSection }): React.JSX.Element {
  return (
    <section
      className="border-t border-t-inset-hair pt-region first:border-t-0 first:pt-0"
      {...{ [SPY_ATTRIBUTE]: section.key }}
    >
      {section.detail}
    </section>
  )
}

/** One owner's run: its heading, then its sections on the axis its ownership earns. */
function FeedGroup({ group }: { group: MasterDetailGroup }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-region">
      {group.label !== null && <SectionHeader label={group.label} count={group.count} />}
      <div
        className={cn(
          'flex flex-col gap-region',
          // The spine, not a box: a delegate's work hangs off a rule the way a quote hangs off a
          // margin. Indented by one nest so the depth is the same step the runtime tree uses.
          group.nested === true && 'ml-tight border-l border-l-inset-hair pl-nest',
        )}
      >
        {group.sections.map((section) => (
          <FeedSection key={section.key} section={section} />
        ))}
      </div>
    </div>
  )
}

/**
 * Organism: the cockpit's one master–detail feel — a navigation list left, one continuous
 * scrollable feed right.
 *
 * Every list/detail surface in the app shares it (`cockpit-spec.md` §4.3): scrolling the detail
 * flows item to item, a scroll-spy moves the left highlight to whatever section is in view, and
 * clicking a row smooth-jumps to its section. The nav pane is a render prop because its shape is
 * the caller's — sections, groups, whatever the surface holds — while the highlight and the jump
 * are this component's.
 */
export function MasterDetail({
  nav,
  groups,
  splitter,
  navClassName,
  className,
}: {
  /** The navigation pane, handed the active key and the jump so its rows can wire both. */
  nav: (api: MasterDetailNav) => React.ReactNode
  /** The feed, in list order, grouped by whose work each run is. */
  groups: readonly MasterDetailGroup[]
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
  const navPane = useRef<HTMLDivElement>(null)
  const { activeKey, jumpTo } = useFeedHighlight(feed, feedKeys(groups).join('|'))

  return (
    <div className={cn('flex min-h-0 min-w-0 flex-1', className)}>
      <div
        ref={navPane}
        className={cn(
          'flex min-h-0 min-w-0 flex-col gap-gap overflow-y-auto p-inset',
          navClassName ?? 'w-[var(--c-act)] shrink-0',
        )}
      >
        {nav({ activeKey, jumpTo })}
      </div>
      {splitter?.({
        measure: () => navPane.current?.getBoundingClientRect().width ?? 0,
      })}
      <div
        ref={feed}
        className="flex min-h-0 min-w-0 flex-1 flex-col gap-region overflow-y-auto p-region"
      >
        {groups.map((group) => (
          <FeedGroup key={group.key} group={group} />
        ))}
      </div>
    </div>
  )
}
