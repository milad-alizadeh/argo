import {
  CaretDownIcon,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  StatusDot,
  Text,
} from '@/shared/components/ui'
import { SUBAGENT_STATES } from '../activityStates'
import { SubagentRow } from '../components/SubagentRow'
import type { Chapter } from './feedIndex'
import type { DelegateItem } from './SubagentScope'

// PROTOTYPE — where the SUBAGENT LIST lives, three placements on the locked synthesis. Each answers
// the same complaint from a different direction: the inline door is invisible until you scroll past
// the turn that spawned it, so where does a fanout announce itself?

export const allDelegates = (chapters: readonly Chapter[]): DelegateItem[] =>
  chapters.flatMap((chapter) => chapter.delegates)

/** F1 — a STANDING CHIPS BAR under the session header: every delegate, session-wide, one chip each.
 * Always visible, so a fanout can never be missed — at the cost of being the exact kind of standing
 * seat this exploration set out to remove. That trade is the thing to judge. */
export function SubagentChips({
  delegates,
  onOpen,
}: {
  delegates: readonly DelegateItem[]
  onOpen: (item: DelegateItem) => void
}): React.JSX.Element | null {
  if (delegates.length === 0) return null
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-snug border-b border-b-inset-hair px-region py-snug">
      <Text variant="tag" className="shrink-0 text-foreground-faint">
        subagents
      </Text>
      {delegates.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onOpen(item)}
          className="flex cursor-pointer items-center gap-snug rounded-full bg-foreground/4 px-gap py-hair hover:bg-foreground/8"
        >
          <StatusDot
            tone={item.subagent.dot.tone}
            glow={item.subagent.dot.glow}
            pulse={item.subagent.dot.pulse}
          />
          <Text variant="tag" className="text-foreground">
            {item.subagent.name}
          </Text>
          <Text variant="tag" className="text-foreground-faint">
            {SUBAGENT_STATES[item.subagent.status].word}
          </Text>
        </button>
      ))}
    </div>
  )
}

/** F2 — a RIGHT RAIL between the feed and the minimap: the shipped dense rows, standing, session-
 * wide. The most legible placement and the most expensive one — it is the old nav pane's seat,
 * narrowed to one job. */
export function SubagentRail({
  delegates,
  onOpen,
}: {
  delegates: readonly DelegateItem[]
  onOpen: (item: DelegateItem) => void
}): React.JSX.Element | null {
  if (delegates.length === 0) return null
  return (
    <div className="flex w-[240px] shrink-0 flex-col gap-tight overflow-y-auto border-l border-l-inset-hair p-inset">
      <Text variant="eyebrow" className="text-foreground-faint">
        subagents
      </Text>
      <ul aria-label="Subagents" className="flex flex-col">
        {delegates.map((item) => (
          <SubagentRow
            key={item.key}
            row={item.subagent}
            selected={false}
            onSelect={() => onOpen(item)}
          />
        ))}
      </ul>
    </div>
  )
}

/** F3 — a chip ON THE SPAWNING TURN'S SEAM: `⑂ 3 subagents` rides the sticky bar, and opens the
 * kit's dropdown listing them. Costs nothing anywhere else, and because the seam is sticky the
 * chip is ON SCREEN the whole time you are inside the turn that delegated. */
export function SeamDelegates({
  delegates,
  onOpen,
}: {
  delegates: readonly DelegateItem[]
  onOpen: (item: DelegateItem) => void
}): React.JSX.Element | null {
  if (delegates.length === 0) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex shrink-0 cursor-pointer items-center gap-hair rounded-full bg-primary/10 px-gap py-hair outline-none hover:bg-primary/15 focus-visible:ring-1 focus-visible:ring-ring/60">
        <Text variant="tag" className="text-primary">
          ⑂ {delegates.length} subagents
        </Text>
        <Text aria-hidden variant="tag" className="text-primary">
          <CaretDownIcon className="icon-sm" />
        </Text>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[380px] p-tight">
        <ul aria-label="Subagents" className="flex flex-col">
          {delegates.map((item) => (
            <SubagentRow
              key={item.key}
              row={item.subagent}
              selected={false}
              onSelect={() => onOpen(item)}
            />
          ))}
        </ul>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
