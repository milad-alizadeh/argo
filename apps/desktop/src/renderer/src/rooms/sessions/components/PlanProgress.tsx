import type { PlanEntryStatus } from '@shared'
import { Text } from '@/shared/components/ui'
import type { PlanProgressModel } from '../interiorActivity'

// A plan entry is a step of a plan, not a live process: it carries a MARK — done, here, not yet —
// rather than a status dot. A dot would put it in the same channel as a running tool call and make
// the eye read four live things where there is one.
//
// GLYPHS, not icons. An icon box is sized for a control and lands heavier than the 11px line it
// marks, which made the plan read as four buttons; a mono glyph sits inside the text's own weight
// and rides its baseline. The column is fixed and centred so the three marks never shift the text.
const ENTRY_MARK: Record<PlanEntryStatus, { glyph: string; tone: string }> = {
  completed: { glyph: '✓', tone: 'text-tone-done' },
  in_progress: { glyph: '▲', tone: 'text-tone-run' },
  pending: { glyph: '○', tone: 'text-foreground-faint' },
}

/** What a mark means, for the reader who cannot see it. The glyph itself is decorative. */
const ENTRY_MARK_LABEL: Record<PlanEntryStatus, string> = {
  completed: 'done',
  in_progress: 'in progress',
  pending: 'not started',
}

const ENTRY_TEXT: Record<PlanEntryStatus, string> = {
  completed: 'text-foreground-faint',
  in_progress: 'text-foreground',
  pending: 'text-foreground-faint',
}

/**
 * Molecule: the agent's own live to-do list — `PLAN · N OF M` over one row per entry.
 *
 * The plan is the agent's, not Argo's: the entries are rendered as it wrote them, and the count is
 * arithmetic over their statuses rather than a separate claim.
 *
 * The entries hang off a SPINE and are not selectable. Both facts are the same point: a plan is what
 * the agent said it would do, and the rows below it in the card are what it has actually done — two
 * different channels that were reading as one flat list. The spine says this block belongs to the
 * turn rather than being another run of its rows, and the entries are set at the same size as those
 * rows because intent is not the smaller fact.
 */
export function PlanProgress({ plan }: { plan: PlanProgressModel }): React.JSX.Element {
  return (
    <div data-component="PlanProgress" className="flex flex-col gap-tight">
      <Text variant="tag" className="text-foreground-faint">
        {`Plan · ${plan.done} of ${plan.total}`}
      </Text>
      <ul
        aria-label="Plan"
        className="flex flex-col gap-hair border-l border-l-inset-hair pl-inset"
      >
        {plan.entries.map((entry) => {
          const { glyph, tone } = ENTRY_MARK[entry.status]
          return (
            <li key={entry.text} className="flex items-baseline gap-snug">
              <Text
                variant="code-inline"
                aria-label={ENTRY_MARK_LABEL[entry.status]}
                className={`w-mark-col shrink-0 text-center ${tone}`}
              >
                {glyph}
              </Text>
              <Text variant="row" className={`min-w-0 truncate ${ENTRY_TEXT[entry.status]}`}>
                {entry.text}
              </Text>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
