import type { FeedRow, MediaRowModel } from '@shared'
import { StatusDot, Text } from '@/shared/components/ui'
import type { PlanProgressModel } from '../sessionPlan'
import { PlanPull } from './ChapterBar'
import { type Chapter, chapterTitle } from './feedIndex'
import { SeamDelegates } from './SubagentPlacements'
import type { DelegateItem } from './SubagentScope'
import { STICKY_BAR } from './stickyBar'

// PROTOTYPE — support for the F placements: the synthesis seam and shot-run segmenter, COPIED from
// VariantSynthesis rather than exported from it, because variant E is being edited concurrently and
// these variants must not touch it. The one addition is the seam's optional delegates slot (F3).

/** A chapter's rows with every run of consecutive shots pulled out as one gallery. */
export type Segment =
  | { key: string; kind: 'rows'; rows: FeedRow[] }
  | { key: string; kind: 'shots'; shots: MediaRowModel[] }

export function segmentsOf(rows: readonly FeedRow[]): Segment[] {
  const segments: Segment[] = []
  // The prompt row is dropped: the sticky seam already leads with the prompt.
  for (const row of rows.filter((candidate) => candidate.kind !== 'prompt')) {
    const last = segments.at(-1)
    if (row.kind === 'media') {
      if (last?.kind === 'shots') last.shots.push(row)
      else segments.push({ key: row.key, kind: 'shots', shots: [row] })
    } else if (last?.kind === 'rows') {
      last.rows.push(row)
    } else {
      segments.push({ key: row.key, kind: 'rows', rows: [row] })
    }
  }
  return segments
}

/** The synthesis seam with one extra slot: when `delegates` is passed (the F3 placement), the
 * `⑂ N subagents` chip rides the seam's right side, next to the plan pull — sticky, so the chip is
 * on screen the whole time you are inside the turn that delegated. */
export function PlacementSeam({
  chapter,
  plan,
  delegates,
  onOpen,
}: {
  chapter: Chapter
  plan: PlanProgressModel | null
  delegates?: readonly DelegateItem[]
  onOpen: (item: DelegateItem) => void
}): React.JSX.Element {
  return (
    <div className={STICKY_BAR}>
      <span className="h-[1.1em] w-[3px] shrink-0 self-center rounded-full bg-primary" />
      <Text variant="row-strong" className="min-w-0 flex-1 truncate text-primary">
        {chapterTitle(chapter)}
      </Text>
      {chapter.open && (
        <StatusDot tone="run" glow="live" pulse label="running" className="self-center" />
      )}
      {delegates && delegates.length > 0 && (
        <span className="self-center">
          <SeamDelegates delegates={delegates} onOpen={onOpen} />
        </span>
      )}
      {plan && <PlanPull plan={plan} />}
    </div>
  )
}
