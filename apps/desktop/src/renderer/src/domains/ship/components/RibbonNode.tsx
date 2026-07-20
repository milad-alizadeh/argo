import type { RibbonNodeKey, RibbonNodeState } from '@shared'
import { cn } from '@/lib/utils'
import { Text } from '@/shared/components/ui'
import { RIBBON_NODE_STATE } from './ribbonNodeState'

const NODE_LABEL: Record<RibbonNodeKey, string> = {
  commits: 'Commits',
  pr: 'PR',
  ci: 'CI',
  review: 'Review',
  merge: 'Merge',
}

export interface RibbonNodeProps {
  /** Which of the five artifacts this node names. Renamed from the study's `key` — a
   * reserved React prop. */
  nodeKey: RibbonNodeKey
  /** Where this node stands. Drives the glyph, its tone and, on the head, the pulse. */
  state: RibbonNodeState
  /** A count or sha echo beside the label — never a re-typed value. */
  sub?: string
  /** R1: the leftmost node that is not fresh. Only the head takes the motion budget
   * (R10), and only while it is `gate`/`fail`/`warn` — stalled on a human. */
  isHead: boolean
  /** Whether this node's drawer is the one currently showing. */
  open: boolean
  /** Whether the node accepts a click — `wait` never does. */
  clickable: boolean
  className?: string
}

/**
 * Molecule: one artifact on the ship ribbon — a stateful glyph disc, its label and an
 * optional sub echo.
 *
 * Gate reads apart from in-progress by FORM, an outer ring, never a second tint (R2) —
 * `now`/`gate`/`sync` share one glyph in `ribbonNodeState.ts` and this component adds the
 * ring itself. Stale renders dashed and struck through (R3), never red: nothing failed.
 */
export function RibbonNode({
  nodeKey,
  state,
  sub,
  isHead,
  open,
  clickable,
  className,
}: RibbonNodeProps): React.JSX.Element {
  const { Icon, glyph, label } = RIBBON_NODE_STATE[state]
  const pulse = isHead && (state === 'gate' || state === 'fail' || state === 'warn')
  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-current={open ? 'true' : undefined}
      title={`${NODE_LABEL[nodeKey]} — ${state === 'stale' ? 'stale: true of an older commit' : state}`}
      className={cn(
        'relative inline-flex shrink-0 items-center gap-snug whitespace-nowrap px-inset py-snug',
        clickable && 'cursor-pointer hover:bg-foreground/4',
        // The "on" node's own drawer is showing beneath the strip — a background wash, the
        // same 4% the hover state already spends, so the row reads highlighted without
        // borrowing a border pixel that would nudge the strip's height.
        open && 'bg-foreground/4',
        className,
      )}
    >
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-full border p-tight text-meta',
          glyph,
          pulse && 'motion-safe:animate-pulse-status',
          state === 'gate' && 'ring-3 ring-primary/24',
        )}
      >
        <Icon aria-hidden />
      </span>
      <Text variant="meta" className={label}>
        {NODE_LABEL[nodeKey]}
      </Text>
      {sub !== undefined && (
        <Text variant="meta" className="text-foreground-faint tabular-nums">
          {sub}
        </Text>
      )}
    </div>
  )
}
