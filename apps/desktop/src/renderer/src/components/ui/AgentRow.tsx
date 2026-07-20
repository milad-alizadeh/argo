import { cn } from '@/lib/utils'
import { type AgentState, agentStateWordClass, showsAgentStateWord } from './agentState'
import { SparkleIcon } from './icons'
import { Text } from './Text'

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
   * channel owns the output (R13/R15). The seam above binds selection to this id. */
  channelId: string
  /** The state the enclosing PhaseGroup or RunRow already reports. A done or queued row
   * that only repeats it drops its own word; without one the row is lone and always words
   * itself. */
  rollupState?: AgentState
  className?: string
}

/** The AgentRow fields that describe the Agent itself — what a Run or a Phase holds. */
export type AgentRowModel = Omit<AgentRowProps, 'rollupState' | 'className'>

// Molecule: one dispatched Agent in the story pane's Actor roster. Static by design — the
// screen's one animation budget belongs to the ribbon, so a running Agent reads as a word,
// never as motion.
export function AgentRow({
  name,
  goal,
  state,
  duration,
  channelId,
  rollupState,
  className,
}: AgentRowProps): React.JSX.Element {
  const showsWord = showsAgentStateWord(state, rollupState)
  return (
    <div
      data-channel-id={channelId}
      title="agent — its stream is a console channel"
      className={cn(
        'flex items-center gap-gap rounded-lg px-gap py-tight hover:bg-foreground/5',
        className,
      )}
    >
      <SparkleIcon aria-hidden className="size-4 text-primary-soft" />
      <Text variant="row-strong" className="shrink-0 text-foreground">
        {name}
      </Text>
      <Text variant="row" className="min-w-0 flex-1 truncate text-muted-foreground">
        {goal}
      </Text>
      {(showsWord || duration !== undefined) && (
        // One trailing meta unit: the state word and the duration read as a single faint
        // column, with the row's only state hue sitting on the word.
        <span className="inline-flex shrink-0 items-baseline gap-tight text-foreground-faint">
          {showsWord && (
            <Text variant="meta" className={agentStateWordClass(state)}>
              {state}
            </Text>
          )}
          {duration !== undefined && <Text variant="meta">{duration}</Text>}
        </span>
      )}
    </div>
  )
}
