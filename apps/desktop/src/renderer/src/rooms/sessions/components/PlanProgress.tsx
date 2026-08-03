import type { PlanEntryStatus } from '@shared'
import { CaretRightIcon, CheckIcon, CircleIcon, Text } from '@/shared/components/ui'
import type { PlanProgressModel } from '../interiorActivity'

// A plan entry carries a MARK, not a status dot: a dot would read as a fourth live thing beside the
// running tool calls. Icons rather than typed-in glyphs, sized by where they sit (the mark column).
const ENTRY_MARK: Record<
  PlanEntryStatus,
  { Glyph: typeof CheckIcon; tone: string; label: string }
> = {
  completed: { Glyph: CheckIcon, tone: 'text-tone-done', label: 'done' },
  in_progress: { Glyph: CaretRightIcon, tone: 'text-tone-run', label: 'in progress' },
  pending: { Glyph: CircleIcon, tone: 'text-foreground-faint', label: 'not started' },
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
          const { Glyph, tone, label } = ENTRY_MARK[entry.status]
          return (
            <li key={entry.text} className="flex items-baseline gap-snug">
              {/* The icon rides INSIDE a `Text`, which is the whole trick: `--icon-box-sm` is
                  em-relative, so an icon dropped straight into this row would size against the
                  15px body and land heavier than the 11px line it marks. Inside the row's own type
                  context it tracks the text it belongs to. */}
              <Text
                variant="row"
                aria-label={label}
                className={`grid w-mark-col shrink-0 place-items-center ${tone}`}
              >
                <Glyph aria-hidden className="icon-sm" />
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
