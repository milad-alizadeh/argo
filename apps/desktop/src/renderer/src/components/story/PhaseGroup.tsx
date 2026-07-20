import { Text, useDisclosure } from '@/components/ui'
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
  /** Seeds whether the members show, standalone. Done phases collapse to their header and
   * future phases are header-only, so a Run usually seeds only the phase being worked open.
   * Ignored once `open` is passed. */
  defaultOpen?: boolean
  /** Drives the disclosure directly — pass this (with `onOpenChange`) for a container to
   * control the Phase from outside; omit it to let the group track its own open state. */
  open?: boolean
  /** Every open/closed transition, whether the Phase is controlled or tracking itself. */
  onOpenChange?: (open: boolean) => void
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
  defaultOpen = false,
  open: openProp,
  onOpenChange,
  className,
}: PhaseGroupProps): React.JSX.Element {
  const [open, toggleOpen] = useDisclosure({ open: openProp, defaultOpen, onOpenChange })
  const { rail, ink, nameInk } = PHASE_PRESENTATION[state]
  const statusText = phaseStatusText(state, members.length, doneAgentCount(members))
  const hasMembers = members.length > 0
  return (
    <div
      data-run-id={runId}
      data-phase={label}
      className={cn('mt-hair mb-tight border-l-2 pl-snug', rail, className)}
    >
      <RosterRow
        // A phase with nothing to open still reserves the caret, so every phase name in the
        // Run starts at the same x.
        caret={hasMembers ? (open ? 'open' : 'closed') : 'reserved'}
        onToggle={toggleOpen}
        toggleLabel={label}
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
      {open && hasMembers && (
        // A phase head is caret + name, so a member (glyph + name) lands its glyph under the
        // phase NAME: one nest step (24) right of the phase caret, which is where the phase
        // content — and so this wrapper's 0 — already begins.
        <div className="ml-nest">
          {members.map((member) => (
            <AgentRow key={member.channelId} {...member} rollupState={PHASE_ROLLUP_STATE[state]} />
          ))}
        </div>
      )}
    </div>
  )
}
