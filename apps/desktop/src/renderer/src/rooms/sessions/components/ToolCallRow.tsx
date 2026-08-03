import { cn } from '@/lib/utils'
import { StatusDot, Text } from '@/shared/components/ui'
import type { ToolStepModel } from '../interiorActivity'
import { NAV_ROW, NAV_ROW_SELECTED } from './rowRecipes'

/**
 * Molecule: one tool call as a step of its turn — `dot · name · target`, with the time it happened
 * held at the right edge.
 *
 * The name is the host's own tool name, never renamed, and the target is the file or command it
 * actually named. State is carried by the dot; a failed call burns red and holds still.
 *
 * The time is the row's one right-hand column and is a CLOCK time, not an age: a turn's calls land
 * seconds apart, so ages would read identically down the whole list. Its column holds even where a
 * record carried no time, so the targets beside it stay on one axis.
 */
export function ToolCallRow({
  step,
  selected,
  onSelect,
}: {
  /** The step, already derived. */
  step: ToolStepModel
  /** Whether the detail feed is currently showing this step. Absent while the feed's sections are
   * TURNS rather than steps: a step earns its own anchor back when tool rows join the feed (issue 317),
   * and until then a highlight here would name a section that does not exist. */
  selected?: boolean
  /** Jump the detail feed to where this step is read. */
  onSelect?: (key: string) => void
}): React.JSX.Element {
  return (
    <li>
      <button
        type="button"
        data-component="ToolCallRow"
        onClick={() => onSelect?.(step.key)}
        aria-current={selected === true ? 'true' : undefined}
        className={cn(NAV_ROW, selected === true && NAV_ROW_SELECTED)}
      >
        <StatusDot tone={step.dot.tone} glow={step.dot.glow} pulse={step.dot.pulse} />
        <Text variant="row" className="shrink-0 text-foreground">
          {step.name}
        </Text>
        <Text variant="code-inline" className="min-w-0 flex-1 truncate text-foreground-faint">
          {step.target}
        </Text>
        {step.at !== null && (
          <Text variant="meta" className="shrink-0 tabular-nums text-foreground-faint">
            {step.at}
          </Text>
        )}
      </button>
    </li>
  )
}
