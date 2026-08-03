import type { ToolCallKind } from '@shared'
import { cn } from '@/lib/utils'
import { Text } from '@/shared/components/ui'
import { SUBAGENT_STATES, turnWord } from '../activityStates'
import type { ActivityItem, ToolStepModel } from '../interiorActivity'
import { TurnFeed } from './TurnFeed'

/** The head every detail section wears: what the item is, and its one state word held to the right
 * edge of the SECTION — never flung to the far side of the pane, where it would sit a screen away
 * from the thing it describes.
 *
 * A PLAIN name — the only mark allowed in front of it is a turn's ordinal. The nav rows beside this
 * feed are the surface's dotted channel; a dot here too would make the head compete with the rows
 * that led you to it, and the word already at its right edge tells the state once. Where nothing
 * observed can name the item, the MARK becomes the heading rather than sitting beside an empty one:
 * a heading with no accessible name is worse than a quiet one. */
function DetailHead({
  name,
  prefix,
  word,
}: {
  /** What the item is. `null` where nothing observed can name it, which leaves the prefix to. */
  name: string | null
  /** A quiet mark in front of the name — a turn's ordinal, which locates the section without
   * claiming to name it. */
  prefix?: string
  word: string
}): React.JSX.Element {
  return (
    <div className="flex items-baseline gap-snug">
      {name !== null && prefix !== undefined && (
        <Text variant="title" className="shrink-0 tabular-nums text-foreground-faint">
          {prefix}
        </Text>
      )}
      <Text
        as="h3"
        variant="title"
        className={cn(
          'min-w-0 flex-1 truncate',
          name === null ? 'tabular-nums text-foreground-faint' : 'text-foreground',
        )}
      >
        {name ?? prefix}
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
 * `ROTATION.TS` is no longer the string that was observed. Mono at the COLUMN's size, not at the
 * `code` roles' — every line in this feed stands on one rung and is separated by colour. */
function MetaLine({ parts }: { parts: readonly (string | null)[] }): React.JSX.Element | null {
  const text = parts.filter((part) => part !== null && part !== '').join(' · ')
  if (text === '') return null
  return (
    <Text variant="prose" className="truncate font-mono text-foreground-faint">
      {text}
    </Text>
  )
}

// The gutter's tone is the call's KIND, so a wall of thirty events shows its shape before it is
// read. Three tones only, because a fourth is a wall again. Written out literally rather than
// interpolated so Tailwind's scanner still sees each class.
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
      <DetailHead name={subagent.name} word={SUBAGENT_STATES[subagent.status].word} />
      <MetaLine
        parts={[
          'subagent',
          group,
          subagent.took,
          subagent.tokens === null ? null : `${subagent.tokens} tokens`,
          subagent.target,
        ]}
      />
      {events.length === 0 ? (
        <Text variant="prose" className="text-foreground-faint">
          no live feed yet — nothing observed from this subagent
        </Text>
      ) : (
        <EventList events={events} />
      )}
    </>
  )
}

/** One exchange, read rather than listed: its head, then the prose of the turn beneath it.
 *
 * Headed by the prompt that opened it — the same line its navigation row wears, so a section and
 * the row that jumps to it read as one thing. The ordinal stays in front as the quiet mark that
 * locates it, counted from the oldest turn so a section keeps its number as the agent answers
 * again. A turn the record carried no prompt for is headed by that number alone. */
function TurnDetail({
  item,
}: {
  item: Extract<ActivityItem, { kind: 'turn' }>
}): React.JSX.Element {
  return (
    <>
      <DetailHead
        prefix={String(item.ordinal)}
        name={item.promptLine}
        word={turnWord(item.stopReason)}
      />
      <TurnFeed rows={item.rows} />
    </>
  )
}

/**
 * Organism: the detail pane's content for one item — a subagent's live feed, or one of this
 * session's own turns read as prose.
 *
 * The pane is always populated: every item in the list has a section here, which is what makes the
 * continuous feed continuous and leaves no empty gutter to look at.
 */
export function AgentFeed({ item }: { item: ActivityItem }): React.JSX.Element {
  return (
    <div data-component="AgentFeed" className="flex flex-col gap-snug">
      {item.kind === 'subagent' ? <SubagentDetail item={item} /> : <TurnDetail item={item} />}
    </div>
  )
}
