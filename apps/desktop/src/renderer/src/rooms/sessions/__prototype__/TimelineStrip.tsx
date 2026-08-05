import type { ToolCallKind } from '@shared'
import { cn } from '@/lib/utils'
import { Text } from '@/shared/components/ui'
import type { ToolStepModel } from '../interiorActivity'
import type { PlanProgressModel } from '../sessionPlan'
import { type Chapter, chapterTitle } from './feedIndex'

// PROTOTYPE — variant D's navigation, on the OTHER AXIS. A vertical index beside a vertical feed is
// always at risk of being the same list twice; a horizontal one cannot be, because it can only afford
// shape and never prose. It also shows the one thing no vertical list shows: proportion — which
// exchange was the big one.
//
// The axis is WORK, not the clock: segments are weighted by how much happened in the turn, because
// `TimelineTurnModel` carries no span. A strip that claimed minutes it never read would be a
// fabricated DIRECT, which is the one thing the surface may not do (CONTEXT.md, degrade-down).

const KIND_TONE: Record<ToolCallKind, string> = {
  edit: 'bg-tone-run',
  delegate: 'bg-primary',
  plan: 'bg-tone-amber/70',
  execute: 'bg-foreground/45',
  read: 'bg-foreground/20',
  search: 'bg-foreground/20',
  fetch: 'bg-foreground/20',
  other: 'bg-foreground/20',
}

/** One call as a vertical tick — the segment's texture, which is what makes a strip of eight boxes
 * readable as eight different exchanges rather than as eight boxes. */
function StepTick({ step }: { step: ToolStepModel }): React.JSX.Element {
  return (
    <div
      className={cn(
        'min-w-px flex-1 rounded-full',
        step.status === 'failed' ? 'bg-tone-red' : KIND_TONE[step.kind],
      )}
    />
  )
}

/** The fork marks under a segment that delegated: a hanging branch per delegate, so a fanout is
 * visible in the shape of the session rather than in a group that stands whether it exists or not. */
function Forks({ delegates }: { delegates: Chapter['delegates'] }): React.JSX.Element | null {
  if (delegates.length === 0) return null
  return (
    <div className="flex items-start gap-hair pl-snug">
      {delegates.map((item) => (
        <div key={item.key} className="h-snug w-px bg-primary/60" />
      ))}
      <Text variant="tag" className="-mt-hair pl-hair text-primary">
        {delegates.length}
      </Text>
    </div>
  )
}

function Segment({
  chapter,
  active,
  onJump,
}: {
  chapter: Chapter
  active: boolean
  onJump: (key: string) => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      title={chapterTitle(chapter)}
      onClick={() => onJump(chapter.key)}
      style={{ flexGrow: Math.max(1, chapter.rows.length) }}
      className={cn(
        'group flex min-w-[2.5rem] shrink cursor-pointer basis-0 flex-col gap-hair rounded-md px-hair py-hair text-left',
        active ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-foreground/4',
      )}
    >
      <div className="flex h-snug items-stretch gap-hair">
        {chapter.steps.map((step) => (
          <StepTick key={step.key} step={step} />
        ))}
      </div>
      <div className="flex items-baseline gap-hair">
        <Text variant="tag" className={cn(active ? 'text-primary' : 'text-foreground-faint')}>
          {chapter.ordinal}
        </Text>
        {/* The title appears on the ACTIVE segment only. Every segment labelled would be the nav
            pane again, rotated ninety degrees and truncated to nothing. */}
        {active && (
          <Text variant="tag" className="min-w-0 truncate text-foreground-faint">
            {chapterTitle(chapter)}
          </Text>
        )}
      </div>
      <Forks delegates={chapter.delegates} />
    </button>
  )
}

/**
 * The whole navigation surface of variant D: the session's shape as one horizontal band above the
 * feed, with the plan as its fill rather than as a block of its own.
 */
export function TimelineStrip({
  chapters,
  activeKey,
  plan,
  onJump,
}: {
  chapters: readonly Chapter[]
  activeKey: string | null
  plan: PlanProgressModel | null
  onJump: (key: string) => void
}): React.JSX.Element {
  return (
    <div className="flex shrink-0 flex-col gap-hair border-b border-b-inset-hair px-region pt-snug pb-hair">
      <div className="flex items-stretch gap-hair">
        {chapters.map((chapter) => (
          <Segment
            key={chapter.key}
            chapter={chapter}
            active={chapter.key === activeKey}
            onJump={onJump}
          />
        ))}
      </div>
      {plan && (
        // The plan as the strip's FILL: intent runs the length of the session, so it reads as a
        // property of the whole band rather than as a fourth list. Its entries are one hover away in
        // the title, and in the feed's own plan row where the agent wrote them.
        <div
          title={plan.entries.map((entry) => `${entry.status} · ${entry.text}`).join('\n')}
          className="flex items-center gap-snug"
        >
          <div className="h-px flex-1 bg-inset-hair">
            <div
              style={{ width: `${(plan.done / Math.max(1, plan.total)) * 100}%` }}
              className="h-px bg-tone-run"
            />
          </div>
          <Text variant="tag" className="shrink-0 text-foreground-faint">
            plan {plan.done}/{plan.total}
          </Text>
        </div>
      )}
    </div>
  )
}
