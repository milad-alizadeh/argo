import { cn } from '@/lib/utils'
import {
  CaretDownIcon,
  CaretLeftIcon,
  CaretRightIcon,
  IconButton,
  Text,
  useDisclosure,
} from '@/shared/components/ui'
import { PlanProgress } from '../components/PlanProgress'
import { DISCLOSURE } from '../components/rowRecipes'
import type { PlanProgressModel } from '../sessionPlan'

// PROTOTYPE — variant B's one piece of standing chrome: a single 32px line that says where in the
// session you are, steps you through it, and hangs the plan off a pull-down instead of a seat.

/** The plan, behind the count that is the only part of it worth standing space. Closed, it is six
 * characters; open, it is the shipped tracker, over the feed rather than beside it. */
export function PlanPull({ plan }: { plan: PlanProgressModel }): React.JSX.Element {
  const [open, toggle] = useDisclosure({ defaultOpen: false })
  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={cn(DISCLOSURE, 'flex items-center gap-hair')}
      >
        <Text variant="tag" className={open ? 'text-primary' : 'text-foreground-faint'}>
          plan {plan.done}/{plan.total}
        </Text>
        <Text aria-hidden variant="tag" className="text-foreground-faint">
          <CaretDownIcon className="icon-sm" />
        </Text>
      </button>
      {open && (
        <div className="absolute top-full right-0 z-10 mt-snug w-[36ch] rounded-lg bg-popover p-inset shadow-lg ring-1 ring-inset-hair">
          <PlanProgress plan={plan} />
        </div>
      )}
    </div>
  )
}

/**
 * Where you are in the session, and the two buttons that move you: `‹ 5 of 8 ›`.
 *
 * A CHAPTER stepper, not a list. Stepping is the interaction a long feed actually gets — the reader
 * wants the next exchange, not the twelfth one — and one line of chrome for it costs a fortieth of
 * what an index of every turn costs.
 */
export function ChapterBar({
  ordinal,
  total,
  title,
  plan,
  onStep,
}: {
  ordinal: number
  total: number
  title: string
  plan: PlanProgressModel | null
  onStep: (delta: number) => void
}): React.JSX.Element {
  return (
    <div className="sticky top-0 z-10 -mx-region -mt-region mb-region flex items-center gap-snug border-b border-b-inset-hair bg-panel/95 px-region py-snug backdrop-blur">
      <IconButton label="Previous turn" onClick={() => onStep(-1)}>
        <CaretLeftIcon className="icon-sm" />
      </IconButton>
      <IconButton label="Next turn" onClick={() => onStep(1)}>
        <CaretRightIcon className="icon-sm" />
      </IconButton>
      <Text variant="tag" className="shrink-0 tabular-nums text-foreground-faint">
        {ordinal} of {total}
      </Text>
      <Text variant="row" className="min-w-0 flex-1 truncate text-foreground-soft">
        {title}
      </Text>
      {plan && <PlanPull plan={plan} />}
    </div>
  )
}
