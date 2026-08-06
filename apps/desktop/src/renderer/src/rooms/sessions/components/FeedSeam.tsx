import { cn } from '@/lib/utils'
import {
  CaretDownIcon,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  StatusDot,
  Text,
} from '@/shared/components/ui'
import { type ChapterModel, chapterTitle } from '../interior/timeline'
import type { PlanProgressModel } from '../plan/sessionPlan'
import { PlanProgress } from './PlanProgress'
import { DISCLOSURE, PANE_BAND } from './rowRecipes'

// The seam a turn starts with, STUCK by CSS: whichever exchange you are inside, its cause and the
// plan's count are the top line of the pane. Always gold — the same gold the minimap's prompt
// ticks wear, which is what makes the strip readable as a legend — and being STUCK is already what
// says "this is the one you are inside", so the seam has no active state and no stop-reason word:
// a finished turn needs no label, and a live one says so with the session's own pulsing run dot.

const STICKY_BAR = cn(
  PANE_BAND,
  'sticky top-0 z-10 -mx-region gap-snug bg-background/90 px-region backdrop-blur-md',
)

/** The plan, behind the count that is the only part of it worth standing space. Closed, it is six
 * characters; open, it is the shipped tracker in the kit's own dropdown — portalled, so it can
 * never land under the feed's content. */
export function PlanPull({ plan }: { plan: PlanProgressModel }): React.JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(DISCLOSURE, 'flex items-center gap-hair')}>
        <Text variant="tag" className="text-foreground-faint">
          plan {plan.done}/{plan.total}
        </Text>
        <Text aria-hidden variant="tag" className="text-foreground-faint">
          <CaretDownIcon className="icon-sm" />
        </Text>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[36ch] p-inset">
        <PlanProgress plan={plan} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Molecule: one turn's sticky seam — its prompt as its name (no number: the prompt is what the
 * exchange is about), the live dot while it runs, and the plan's count on the right edge. */
export function FeedSeam({
  chapter,
  plan,
}: {
  chapter: ChapterModel
  plan: PlanProgressModel | null
}): React.JSX.Element {
  return (
    <div data-component="FeedSeam" className={STICKY_BAR}>
      {/* No gold bar. The TITLE is already gold — the same ink the strip paints a prompt — so the
          stub beside it said the one thing the words were saying, and it was the last border left
          on a surface where every other row carries its tier in colour alone. */}
      <Text variant="row-strong" className="min-w-0 flex-1 truncate text-primary">
        {chapterTitle(chapter)}
      </Text>
      {chapter.open && (
        <StatusDot tone="run" glow="live" pulse label="running" className="self-center" />
      )}
      {plan && <PlanPull plan={plan} />}
    </div>
  )
}
