import { Text } from '@/components/ui'
import { SparkleIcon } from '@/components/ui/icons'
import { type AgentState, showsAgentStateWord } from './agentState'
import { RosterRow } from './RosterRow'

export type AgentRowProps = {
  /** The Agent's name. */
  name: string
  /** What this Agent was dispatched to do, in the row's muted descriptor role. */
  goal: string
  /** Where the Agent stands. */
  state: AgentState
  /** How long it has been running, or ran for. A queued Agent has none yet. */
  duration?: string
  /** The console channel carrying this Agent's stream — the roster owns the state, the
   * channel owns the output (R13/R15). Lands as `data-channel-id` for the seam above. */
  channelId: string
  /** The state the enclosing PhaseGroup or RunRow already reports. A done or queued row
   * that only repeats it drops its own word; without one the row is lone and always words
   * itself. */
  rollupState?: AgentState
  /** Extra classes for the row itself. */
  className?: string
}

/** The AgentRow fields that describe the Agent itself — what a Run or a Phase holds. */
export type AgentRowModel = Omit<AgentRowProps, 'rollupState' | 'className'>

// Molecule: one dispatched Agent in the story pane's Actor roster. Static by design — the
// screen's one animation budget belongs to the ribbon, so a running Agent reads as a word.
export function AgentRow({
  name,
  goal,
  state,
  duration,
  channelId,
  rollupState,
  className,
}: AgentRowProps): React.JSX.Element {
  return (
    <RosterRow
      glyph={SparkleIcon}
      title="agent — its stream is a console channel"
      channelId={channelId}
      stateWord={showsAgentStateWord(state, rollupState) ? state : undefined}
      duration={duration}
      className={className}
    >
      <Text variant="row-strong" className="shrink-0 text-foreground">
        {name}
      </Text>
      <Text variant="row" className="min-w-0 flex-1 truncate text-muted-foreground">
        {goal}
      </Text>
    </RosterRow>
  )
}
