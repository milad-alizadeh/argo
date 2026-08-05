import { SectionHeader, Text } from '@/shared/components/ui'
import type { FeedSectionModel } from '../interiorActivity'
import { TurnRow } from './TurnRow'

/**
 * Organism: the Timeline section — the displayed agent's turns, oldest first, past ones folded.
 *
 * It reads the SAME sections the feed draws, so the two panes cannot disagree about what a step is: a
 * row here is one section or one folded row of that feed, never a tool call the feed folded away.
 *
 * It shares the Subagents group's header treatment: two distinct sections, one header style. Nothing
 * from the fanout is interleaved here, because a subagent is not a step of this agent's turn — it is
 * its own feed, which the Subagents group switches the pane to.
 */
export function TurnTimeline({
  sections,
  activeKey,
  onSelect,
}: {
  /** The feed's sections, oldest first — the live turn last. */
  sections: readonly FeedSectionModel[]
  /** Which anchor the detail feed is showing, tracked by scroll-spy. */
  activeKey: string | null
  /** Jump the detail feed to an anchor — a turn's section, or one row inside it. */
  onSelect?: (key: string) => void
}): React.JSX.Element {
  return (
    <section data-component="TurnTimeline" className="flex flex-col gap-tight">
      <SectionHeader label="Timeline" count="live turn last · past folded" />
      {sections.length === 0 ? (
        <Text variant="meta" className="text-foreground-faint">
          nothing observed yet
        </Text>
      ) : (
        <ul aria-label="Timeline" className="flex flex-col gap-gap">
          {sections.map((section) => (
            <TurnRow
              key={section.key}
              turn={section.turn}
              activeKey={activeKey}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
