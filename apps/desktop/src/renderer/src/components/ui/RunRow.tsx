import { Fragment } from 'react'
import { cn } from '@/lib/utils'
import type { AgentRowModel } from './AgentRow'
import { AgentRow } from './AgentRow'
import { agentStateWordClass, doneAgentCount } from './agentState'
import { ArrowRightIcon, CaretDownIcon, CaretRightIcon, TreeStructureIcon } from './icons'
import { PhaseGroup } from './PhaseGroup'
import { PHASE_PRESENTATION, type PhaseState, phaseOpensByDefault } from './phaseState'
import { Text } from './Text'

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
}

/** A Run member is an Agent plus the Phase it belongs to — flat members carry no phase. */
export type RunMember = AgentRowModel & { phase?: string }

export type RunRowProps = {
  /** The Run's name. */
  label: string
  shape: RunShape
  /** Where the Run stands. Its progress is what normally reports this, so only a failed
   * Run spends a state word. */
  state: RunState
  duration?: string
  /** Every Agent in the Run. A `pipeline` partitions these by `phase`. */
  members: readonly RunMember[]
  /** The Phases a `pipeline` runs through, in order. A batch has none. */
  phases?: readonly RunPhase[]
  /** Whether the members are showing. */
  open: boolean
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

// Molecule: a Run in the story pane's Actor roster — a batch or a dynamic workflow, with
// its member AgentRows nested beneath. The progress summary shows only while collapsed:
// expanded, the phase rails and member rows already carry the same information.
export function RunRow({
  label,
  shape,
  state,
  duration,
  members,
  phases,
  open,
  className,
}: RunRowProps): React.JSX.Element {
  const shapeWord = SHAPE_WORD[shape]
  const Caret = open ? CaretDownIcon : CaretRightIcon
  return (
    <div className={className}>
      <div
        title={`${shapeWord} — a Run of ${members.length} agents`}
        className="flex items-center gap-gap rounded-lg px-gap py-tight hover:bg-foreground/5"
      >
        <Caret aria-hidden className="size-3 text-foreground-faint" />
        <TreeStructureIcon aria-hidden className="size-4 text-primary-soft" />
        {/* The name is what gives way when the row runs out of width — the progress
            summary beside it is the Run's state and must stay whole. */}
        <Text variant="row-strong" className="min-w-0 truncate text-foreground">
          {label}
        </Text>
        <Text variant="meta" className="shrink-0 text-muted-foreground">
          {shapeWord}
        </Text>
        {!open && <RunProgress members={members} phases={phases} />}
        <span className="flex-1" />
        {(state === 'failed' || duration !== undefined) && (
          <span className="inline-flex shrink-0 items-baseline gap-tight text-foreground-faint">
            {state === 'failed' && (
              <Text variant="meta" className={agentStateWordClass(state)}>
                {state}
              </Text>
            )}
            {duration !== undefined && <Text variant="meta">{duration}</Text>}
          </span>
        )}
      </div>
      {open && <RunMembers label={label} state={state} members={members} phases={phases} />}
    </div>
  )
}

// The collapsed run's own state: a phase glyph-walk for a workflow, a done-count for a
// batch. Only the phase being worked carries a hue; past and future stay in the meta role.
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
    <span className="inline-flex shrink-0 items-center gap-tight">
      {phases.map((phase, index) => {
        const { glyph: Glyph } = PHASE_PRESENTATION[phase.state]
        return (
          <Fragment key={phase.label}>
            {index > 0 && <ArrowRightIcon aria-hidden className="icon-sm text-foreground-faint" />}
            <Text
              variant="meta"
              className={cn(
                'inline-flex items-center gap-hair',
                phase.state === 'run' ? 'text-tone-run' : 'text-foreground-faint',
              )}
            >
              {phase.label}
              <Glyph aria-hidden className="icon-sm" />
              {phase.count}
            </Text>
          </Fragment>
        )
      })}
    </span>
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
      <div className="mt-hair mb-tight ml-6">
        {phases.map((phase) => (
          <PhaseGroup
            key={phase.label}
            // A Run has no id of its own in the roster — its name is what identifies it.
            runId={label}
            label={phase.label}
            state={phase.state}
            members={membersOfPhase(members, phase.label)}
            open={phaseOpensByDefault(phase.state)}
          />
        ))}
      </div>
    )
  }
  return (
    <div className="mt-hair mb-tight ml-6 border-l border-inset-hair pl-snug">
      {members.map((member) => (
        <AgentRow key={member.channelId} {...agentOf(member)} rollupState={state} />
      ))}
    </div>
  )
}
