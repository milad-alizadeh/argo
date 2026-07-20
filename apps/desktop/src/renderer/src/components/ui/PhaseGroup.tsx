import { cn } from '@/lib/utils'
import { AgentRow, type AgentRowModel } from './AgentRow'
import { doneAgentCount } from './agentState'
import { CaretDownIcon, CaretRightIcon } from './icons'
import {
  PHASE_PRESENTATION,
  PHASE_ROLLUP_STATE,
  type PhaseState,
  phaseStatusText,
} from './phaseState'
import { Text } from './Text'

export type PhaseGroupProps = {
  /** Which Run this Phase belongs to — a Phase name is only unique within its Run. */
  runId: string
  /** The Phase's name, in the eyebrow role. */
  label: string
  /** Where the Phase stands. The left rail is what shows it. */
  state: PhaseState
  /** The Agents grouped under this Phase. */
  members: readonly AgentRowModel[]
  /** Whether the members are showing. Done phases collapse to their header and future
   * phases are header-only, so only the phase being worked opens by default. */
  open: boolean
  className?: string
}

// Molecule: a Run's members grouped under the Phase that owns them. A Phase is a grouping,
// not an Actor, so it has no icon and no duration — its left rail carries the state and
// its status word repeats that hue inline, leaving the right edge a clean duration column.
export function PhaseGroup({
  runId,
  label,
  state,
  members,
  open,
  className,
}: PhaseGroupProps): React.JSX.Element {
  const { rail, ink } = PHASE_PRESENTATION[state]
  const statusText = phaseStatusText(state, members.length, doneAgentCount(members))
  const Caret = open ? CaretDownIcon : CaretRightIcon
  return (
    <div
      data-run-id={runId}
      data-phase={label}
      className={cn('my-hair border-l-2 pl-gap', rail, className)}
    >
      <div
        title={`phase ${label} — ${statusText}`}
        className="flex items-center gap-gap rounded-lg px-gap py-hair"
      >
        {/* The caret box holds its width with no members, so every phase name lines up. */}
        <span className="inline-flex size-3 shrink-0 items-center text-foreground-faint">
          {members.length > 0 && <Caret aria-hidden className="icon-sm" />}
        </span>
        <Text
          variant="eyebrow"
          className={state === 'wait' ? 'text-foreground-faint' : 'text-muted-foreground'}
        >
          {label}
        </Text>
        <Text variant="meta" className={cn('shrink-0', ink)}>
          {statusText}
        </Text>
      </div>
      {open && members.length > 0 && (
        <div className="ml-inset">
          {members.map((member) => (
            <AgentRow key={member.channelId} {...member} rollupState={PHASE_ROLLUP_STATE[state]} />
          ))}
        </div>
      )}
    </div>
  )
}
