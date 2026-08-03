import { SectionHeader, Text } from '@/shared/components/ui'
import type { TimelineTurnModel } from '../interiorActivity'
import { TurnRow } from './TurnRow'

/**
 * Organism: the Timeline section — this session's turns, oldest first, past ones folded.
 *
 * It shares the Subagents group's header treatment: two distinct sections, one header style. Nothing
 * from the fanout is interleaved here, because a subagent is not a step of the session's own turn.
 */
export function TurnTimeline({
  turns,
  activeKey,
  onSelect,
}: {
  /** The turns, already ordered oldest first — the live one last. */
  turns: readonly TimelineTurnModel[]
  /** Which item the detail feed is showing, tracked by scroll-spy. */
  activeKey: string | null
  /** Jump the detail feed to a step's events. */
  onSelect?: (key: string) => void
}): React.JSX.Element {
  return (
    <section data-component="TurnTimeline" className="flex flex-col gap-tight">
      <SectionHeader label="Timeline" count="live turn last · past folded" />
      {turns.length === 0 ? (
        <Text variant="meta" className="text-foreground-faint">
          nothing observed yet
        </Text>
      ) : (
        <ul aria-label="Timeline" className="flex flex-col gap-gap">
          {turns.map((turn) => (
            <TurnRow key={turn.key} turn={turn} activeKey={activeKey} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </section>
  )
}
