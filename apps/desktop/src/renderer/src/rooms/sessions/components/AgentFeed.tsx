import type { ToolCallKind } from '@shared'
import { cn } from '@/lib/utils'
import { Text } from '@/shared/components/ui'
import { stepWord, subagentWord } from '../activityWords'
import type { ActivityItem, ToolStepModel } from '../interiorActivity'

/** The head every detail section wears: what the item is, and its one state word held to the right
 * edge of the SECTION — never flung to the far side of the pane, where it would sit a screen away
 * from the thing it describes.
 *
 * A PLAIN name, with no dot in front of it. The nav rows beside this feed are the surface's dotted
 * channel; a dot here too would make the head compete with the rows that led you to it, and the
 * word already at its right edge tells the state once. */
function DetailHead({ name, word }: { name: string; word: string }): React.JSX.Element {
  return (
    <div className="flex items-baseline gap-snug">
      <Text as="h3" variant="title" className="min-w-0 flex-1 truncate text-foreground">
        {name}
      </Text>
      <Text variant="eyebrow" className="shrink-0 text-foreground-faint">
        {word}
      </Text>
    </div>
  )
}

/** The line under the head: what kind of thing this is, in the feed's own quiet mono. Assembled
 * from what was observed and nothing else — an absent part drops out rather than reading empty.
 *
 * Mono at its own case, NOT the uppercasing tag role: a path or a command shouted back as
 * `ROTATION.TS` is no longer the string that was observed. */
function MetaLine({ parts }: { parts: readonly (string | null)[] }): React.JSX.Element | null {
  const text = parts.filter((part) => part !== null && part !== '').join(' · ')
  if (text === '') return null
  return (
    <Text variant="code-inline" className="truncate text-foreground-faint">
      {text}
    </Text>
  )
}

// What the gutter is TONED by when nothing failed: the kind of thing the call did. A wall of thirty
// events then shows its shape before a word of it is read — where the agent was looking, where it
// changed something, where it handed work off. Three tones only, because a fourth is a wall again:
// mutating in the live ink, delegation in the attention ink, everything observational left quiet.
// Written out literally rather than interpolated so Tailwind's scanner still sees each class.
const KIND_TONE: Record<ToolCallKind, string> = {
  edit: 'text-tone-run',
  delegate: 'text-primary',
  read: 'text-foreground-faint',
  search: 'text-foreground-faint',
  fetch: 'text-foreground-faint',
  execute: 'text-foreground-faint',
  plan: 'text-foreground-faint',
  other: 'text-foreground-faint',
}

/** One observed event: its kind in a fixed gutter, its content beside. The gutter is a column, not
 * a prefix — every row's content starts on the same axis, which is what makes a long feed scannable
 * rather than ragged. */
function EventRow({ step }: { step: ToolStepModel }): React.JSX.Element {
  return (
    <li className="flex items-baseline gap-gap">
      {/* State on a row is ONE channel: the gutter burns for the call that failed, and the word
          itself is told once, by the section's head. Both would be the same state told twice.
          Failure outranks kind — a failed edit is a failure first. */}
      <Text
        variant="tag"
        className={cn(
          'w-kind-col shrink-0 truncate',
          step.status === 'failed' ? 'text-tone-red' : KIND_TONE[step.kind],
        )}
      >
        {step.kind}
      </Text>
      <Text variant="code" className="min-w-0 flex-1 text-foreground-soft">
        {step.target === null ? step.name : `${step.name} · ${step.target}`}
      </Text>
    </li>
  )
}

/** The events, on a rule that runs the length of the feed so a wall of them reads as one column of
 * one agent's work rather than as loose lines. */
function EventList({ events }: { events: readonly ToolStepModel[] }): React.JSX.Element {
  return (
    <ul
      aria-label="Subagent feed"
      className="flex flex-col gap-snug border-l border-l-inset-hair pl-inset"
    >
      {events.map((step) => (
        <EventRow key={step.key} step={step} />
      ))}
    </ul>
  )
}

function SubagentDetail({
  item,
}: {
  item: Extract<ActivityItem, { kind: 'subagent' }>
}): React.JSX.Element {
  const { subagent, group, events } = item
  return (
    <>
      <DetailHead name={subagent.name} word={subagentWord(subagent.status)} />
      <MetaLine parts={['subagent', group, subagent.target]} />
      {events.length === 0 ? (
        <Text variant="meta" className="text-foreground-faint">
          no live feed yet — nothing observed from this subagent
        </Text>
      ) : (
        <EventList events={events} />
      )}
    </>
  )
}

// What a step's own section says it is, from its status alone — the record carries no start time for
// a running call, so the line names the state rather than reporting an age it never observed.
const STEP_META: Record<ToolStepModel['status'], string> = {
  in_progress: 'step of the current turn',
  completed: 'completed step',
  failed: 'the step that failed',
  pending: 'not started · queued step',
}

/** A step's section is the step itself — head, what kind of step it is, and the one thing it named.
 * It gets no event list: a single call listed under its own heading would say the same thing twice
 * in three lines, which is what a feed of thirty of them cannot afford. */
function StepDetail({ step }: { step: ToolStepModel }): React.JSX.Element {
  return (
    <>
      <DetailHead name={step.name} word={stepWord(step.status)} />
      <MetaLine parts={[STEP_META[step.status], step.kind]} />
      <Text variant="code" className="truncate text-foreground-soft">
        {step.target ?? 'this call named no target'}
      </Text>
    </>
  )
}

/**
 * Organism: the detail pane's content for one item — a subagent's live feed, or a tool step's own
 * record.
 *
 * The pane is always populated: every item in the list has a section here, which is what makes the
 * continuous feed continuous and leaves no empty gutter to look at.
 */
export function AgentFeed({ item }: { item: ActivityItem }): React.JSX.Element {
  return (
    <div data-component="AgentFeed" className="flex flex-col gap-snug">
      {item.kind === 'subagent' ? <SubagentDetail item={item} /> : <StepDetail step={item.step} />}
    </div>
  )
}
