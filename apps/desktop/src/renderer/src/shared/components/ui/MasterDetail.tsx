import { useRef } from 'react'
import { cn } from '@/lib/utils'
import { jumpToSection, SPY_ATTRIBUTE, useScrollSpy } from './useScrollSpy'

/** One item of the surface: the key that ties its nav row to its section of the feed, and the
 * detail the feed renders for it. */
export interface MasterDetailSection {
  key: string
  detail: React.ReactNode
}

/** What the nav pane is handed so its rows can highlight and jump. The list is navigation only —
 * it never renders detail of its own. */
export interface MasterDetailNav {
  /** The section currently in view, tracked by scroll-spy rather than by the last click. */
  activeKey: string | null
  /** Smooth-jump the feed to a section. Click still works — it just is not the only way there. */
  jumpTo: (key: string) => void
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
  sections,
  splitter,
  navClassName,
  className,
}: {
  /** The navigation pane, handed the active key and the jump so its rows can wire both. */
  nav: (api: MasterDetailNav) => React.ReactNode
  /** The feed, in list order. Each section is reachable by its key and spied on for the highlight. */
  sections: readonly MasterDetailSection[]
  /** The drag handle between the panes. The surface owns which edge it moves, so it passes one in
   * rather than this primitive inventing a layout state of its own. */
  splitter?: React.ReactNode
  /** Sizing for the nav pane — the surface owns its width, not this primitive. */
  navClassName?: string
  className?: string
}): React.JSX.Element {
  const feed = useRef<HTMLDivElement>(null)
  const activeKey = useScrollSpy(feed, sections.map((section) => section.key).join('|'))

  return (
    <div className={cn('flex min-h-0 min-w-0 flex-1', className)}>
      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-col gap-gap overflow-y-auto p-inset',
          navClassName ?? 'w-[var(--c-act)] shrink-0',
        )}
      >
        {nav({
          activeKey,
          jumpTo: (key) => jumpToSection(feed.current, key),
        })}
      </div>
      {splitter}
      <div
        ref={feed}
        className="flex min-h-0 min-w-0 flex-1 flex-col gap-region overflow-y-auto p-region"
      >
        {sections.map((section) => (
          // The section wrapper is the spy's anchor and the jump's target; the caller owns
          // everything inside it. A hairline separates neighbours — one continuous feed still has to
          // say where one item ends, or a scroll through thirty of them reads as one long list.
          <section
            key={section.key}
            className="border-t border-t-inset-hair pt-region first:border-t-0 first:pt-0"
            {...{ [SPY_ATTRIBUTE]: section.key }}
          >
            {section.detail}
          </section>
        ))}
      </div>
    </div>
  )
}
