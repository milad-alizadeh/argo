import { Text } from '@/components/ui'
import { cn } from '@/lib/utils'
import { AgentRow, type AgentRowModel } from './AgentRow'
import { doneAgentCount } from './agentState'
import {
  PHASE_PRESENTATION,
  PHASE_ROLLUP_STATE,
  type PhaseState,
  phaseStatusText,
} from './phaseState'
import { RosterRow } from './RosterRow'

export type PhaseGroupProps = {
  /** Which Run this Phase belongs to — a Phase name is only unique within its Run. Lands as
   * `data-run-id` beside `data-phase`, which together key the Phase for the seam above. */
  runId: string
  /** The Phase's name, in the eyebrow role. Also lands as `data-phase`. */
  label: string
  /** Where the Phase stands. The left rail is what shows it. */
  state: PhaseState
  /** The Agents grouped under this Phase. */
  members: readonly AgentRowModel[]
  /** Whether the members are showing. Done phases collapse to their header and future
   * phases are header-only, so only the phase being worked opens by default. */
  open: boolean
  /** Extra classes for the group's outer element. */
  className?: string
}

// Molecule: a Run's members grouped under the Phase that owns them. A Phase is a grouping,
// not an Actor, so it has no glyph and no duration — its left rail carries the state.
export function PhaseGroup({
  runId,
  label,
  state,
  members,
  open,
  className,
}: PhaseGroupProps): React.JSX.Element {
  const { rail, ink, nameInk } = PHASE_PRESENTATION[state]
  const statusText = phaseStatusText(state, members.length, doneAgentCount(members))
  return (
    <div
      data-run-id={runId}
      data-phase={label}
      className={cn('mt-hair mb-tight border-l-2 pl-gap', rail, className)}
    >
      <RosterRow
        // A phase with nothing to open still reserves the caret, so every phase name in the
        // Run starts at the same x.
        caret={members.length === 0 ? 'reserved' : open ? 'open' : 'closed'}
        title={`phase ${label} — ${statusText}`}
        className="py-hair"
      >
        <Text variant="eyebrow" className={nameInk}>
          {label}
        </Text>
        <Text variant="meta" className={cn('shrink-0', ink)}>
          {statusText}
        </Text>
      </RosterRow>
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
