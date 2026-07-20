import { Fragment } from 'react'
import { cn } from '@/lib/utils'
import { Text, useDisclosure } from '@/shared/components/ui'
import { ArrowRightIcon, TreeStructureIcon } from '@/shared/components/ui/icons'
import type { AgentRowModel } from './AgentRow'
import { AgentRow } from './AgentRow'
import { doneAgentCount } from './agentState'
import { PhaseGroup } from './PhaseGroup'
import { PHASE_PRESENTATION, type PhaseState, phaseOpensByDefault } from './phaseState'
import { RosterRow } from './RosterRow'

export const RUN_SHAPES = ['batch', 'pipeline'] as const

/** How a Run is organised: a flat `batch` of Agents, or a `pipeline` of named Phases. */
export type RunShape = (typeof RUN_SHAPES)[number]

export const RUN_STATES = ['running', 'done', 'failed'] as const

/** Where a Run stands. A Run is never `queued` — dispatching it is what creates it. */
export type RunState = (typeof RUN_STATES)[number]

// The domain keeps `pipeline`; the UI never says that word (R15).
const SHAPE_WORD: Record<RunShape, string> = {
  batch: 'batch',
  pipeline: 'dynamic workflow',
}

/** One Phase of a `pipeline` Run, as the Run reports it. */
export type RunPhase = {
  /** The Phase's name. Also how its members find it. */
  label: string
  state: PhaseState
  /** The tally the collapsed progress walk shows beside the Phase's glyph. */
  count?: string
  /** Whether this Phase shows its members, overriding `phaseOpensByDefault`. This is where
   * a container records that the user expanded or collapsed the Phase by hand. */
  open?: boolean
}

/** A Run member is an Agent plus the Phase it belongs to — flat members carry no phase. */
export type RunMember = AgentRowModel & { phase?: string }

export type RunRowProps = {
  /** The Run's name. */
  label: string
  /** Whether the Run is a flat batch or a phased workflow — this is what decides the
   * collapsed progress summary's shape and whether members group. */
  shape: RunShape
  /** Where the Run stands. Its progress is what normally reports this, so only a failed
   * Run spends a state word. */
  state: RunState
  /** How long the Run has been going, or went for. */
  duration?: string
  /** Every Agent in the Run. A `pipeline` partitions these by `phase`. */
  members: readonly RunMember[]
  /** The Phases a `pipeline` runs through, in order. A batch has none. */
  phases?: readonly RunPhase[]
  /** Seeds whether the members show, standalone. Ignored once `open` is passed. */
  defaultOpen?: boolean
  /** Drives the disclosure directly — pass this (with `onOpenChange`) for a container (#30)
   * to control the Run from outside; omit it to let the row track its own open state. */
  open?: boolean
  /** Every open/closed transition, whether the Run is controlled or tracking itself. */
  onOpenChange?: (open: boolean) => void
  /** Extra classes for the Run's outer element. */
  className?: string
}

function agentOf({ phase: _phase, ...agent }: RunMember): AgentRowModel {
  return agent
}

function membersOfPhase(
  members: readonly RunMember[],
  phaseLabel: string,
): readonly AgentRowModel[] {
  return members.filter((member) => member.phase === phaseLabel).map(agentOf)
}

// Molecule: a Run in the story pane's Actor roster — a batch or a dynamic workflow, with its
// member AgentRows nested beneath. The progress summary shows only while collapsed:
// expanded, the phase rails and member rows already carry the same information.
export function RunRow({
  label,
  shape,
  state,
  duration,
  members,
  phases,
  defaultOpen = false,
  open: openProp,
  onOpenChange,
  className,
}: RunRowProps): React.JSX.Element {
  const [open, toggleOpen] = useDisclosure({ open: openProp, defaultOpen, onOpenChange })
  const shapeWord = SHAPE_WORD[shape]
  // A Run dispatched with nothing in it yet has nothing to open — the caret reserves its
  // width rather than becoming a dead button (mirrors PhaseGroup's own empty-members rule).
  const hasContent = phases ? phases.length > 0 : members.length > 0
  return (
    <div className={className}>
      <RosterRow
        caret={hasContent ? (open ? 'open' : 'closed') : 'reserved'}
        onToggle={toggleOpen}
        toggleLabel={label}
        glyph={TreeStructureIcon}
        title={`${shapeWord} — a Run of ${members.length} agents`}
        stateWord={state === 'failed' ? state : undefined}
        duration={duration}
      >
        {/* The name is what gives way when the row runs out of width — the progress summary
            beside it is the Run's state and must stay whole. */}
        <Text variant="row-strong" className="min-w-0 truncate text-foreground">
          {label}
        </Text>
        <Text variant="meta" className="shrink-0 text-muted-foreground">
          {shapeWord}
        </Text>
        {!open && <RunProgress members={members} phases={phases} />}
      </RosterRow>
      {open && <RunMembers label={label} state={state} members={members} phases={phases} />}
    </div>
  )
}

// The collapsed run's own state: a phase glyph-walk for a workflow, a done-count for a
// batch. The whole walk sits in the meta role, so its arrows and glyphs are sized by the
// text they separate rather than by the root font.
function RunProgress({
  members,
  phases,
}: Pick<RunRowProps, 'members' | 'phases'>): React.JSX.Element {
  if (!phases) {
    return (
      <Text variant="meta" className="shrink-0 text-foreground-faint">
        {`${doneAgentCount(members)}/${members.length} done`}
      </Text>
    )
  }
  return (
    <Text variant="meta" className="inline-flex shrink-0 items-center gap-tight">
      {phases.map((phase, index) => {
        const { glyph: Glyph, walkInk } = PHASE_PRESENTATION[phase.state]
        return (
          <Fragment key={phase.label}>
            {index > 0 && <ArrowRightIcon aria-hidden className="text-foreground-faint" />}
            <span className={cn('inline-flex items-center gap-hair', walkInk)}>
              {phase.label}
              <Glyph aria-hidden />
              {phase.count}
            </span>
          </Fragment>
        )
      })}
    </Text>
  )
}

// A batch's members list flat under a hairline spine; a workflow's group under their
// PhaseGroups, whose own rails replace that spine.
function RunMembers({
  label,
  state,
  members,
  phases,
}: Pick<RunRowProps, 'label' | 'state' | 'members' | 'phases'>): React.JSX.Element {
  if (phases) {
    return (
      // Phase groups are children of the run, so the phase caret lands under the run's NAME.
      // This clears the run's two marker columns (caret + tree-icon) — one nest step of
      // margin plus one region of padding; PhaseGroup's own rail + pad and the row's shared
      // gap carry the caret the rest of the way onto the run-name axis.
      <div className="mt-hair mb-tight ml-nest pl-region">
        {phases.map((phase) => (
          <PhaseGroup
            key={phase.label}
            // A Run has no id of its own in the roster — its name is what identifies it.
            runId={label}
            label={phase.label}
            state={phase.state}
            members={membersOfPhase(members, phase.label)}
            defaultOpen={phase.open ?? phaseOpensByDefault(phase.state)}
          />
        ))}
      </div>
    )
  }
  return (
    // Batch members are children of the run, so their leading marker (the glyph) lands under
    // the run's NAME — the run's two marker columns in, one nest step of margin plus one of
    // padding. The hairline spine's own 1px pushes the glyph a single pixel past the name;
    // within the row's tolerance and not worth an off-rhythm constant to shave.
    <div className="mt-hair mb-tight ml-nest border-l border-inset-hair pl-nest">
      {members.map((member) => (
        <AgentRow key={member.channelId} {...agentOf(member)} rollupState={state} />
      ))}
    </div>
  )
}
