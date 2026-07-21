import { cn } from '@/lib/utils'
import { Badge, Button, Text } from '@/shared/components/ui'
import { findingBodyStub } from './diffModel'
import {
  FINDING_SEVERITY,
  FINDING_STATE_ACTION,
  FINDING_STATE_REPORT,
  type FindingSeverity,
  type FindingState,
} from './findingState'

// The card's own accent — a solid left rail + a faint wash, one pair per severity. Switched
// (not read off `FINDING_SEVERITY.tone`) because a raw border/background pair is a rendering
// detail this card owns, distinct from the `tone` a caller hands a Badge or Button.
//
// Side-specific longhands (`border-l-<width>` / `border-l-<color>`), never the all-sides
// `border-<color>` shorthand: the row already carries a `border-t-inset-hair` hair, and
// tailwind-merge collapses two `border-color` utilities to the last one — which silently ate
// both the inset-hair top and the left rail's width. The `length:` hint keeps the arbitrary
// width out of the color group so it survives the merge.
function severityAccent(severity: FindingSeverity): { icon: string; card: string } {
  switch (severity) {
    case 'blocking':
      return {
        icon: 'text-verdict-block',
        card: 'border-l-[length:var(--border-roster)] border-l-verdict-block bg-verdict-block-tint/6',
      }
    case 'advisory':
      return {
        icon: 'text-verdict-changes',
        card: 'border-l-[length:var(--border-roster)] border-l-verdict-changes bg-verdict-changes-tint/6',
      }
  }
}

/**
 * Molecule: a verdict-tinted card wedged under a diff hunk, reporting one review finding.
 *
 * Distinct from `FindingRow` (the Review tab's list row) — same finding, two homes (R14): a
 * FindingRow jumps here (`walkFocus`), never the other way, since this card is already
 * sitting in the diff it would otherwise route to. A `fixed` finding collapses to a one-line
 * stub.
 */
export function FindingCard({
  severity,
  state,
  line,
  body,
  by,
  walkFocus = false,
  onAdvanceState,
}: {
  /** How serious this finding is — blocking or advisory, per `ui/findingState.ts`. */
  severity: FindingSeverity
  /** Where this finding stands in its Open → Addressing → Fixed cycle. */
  state: FindingState
  /** The line in the hunk this finding is anchored to. */
  line: number
  /** The finding's prose, from the agent review. */
  body: string
  /** Who raised it (`argo · code-review`). */
  by: string
  /** Highlighted after a jump from the Review tab's walk-through. */
  walkFocus?: boolean
  /** Advance the finding's state — Address → Mark fixed → Reopen, per `FINDING_STATE_ACTION`. */
  onAdvanceState: () => void
}): React.JSX.Element {
  const resolved = state === 'fixed'
  const accent = severityAccent(severity)
  const SeverityIcon = FINDING_SEVERITY[severity].Icon
  const report = FINDING_STATE_REPORT[state]
  const action = FINDING_STATE_ACTION[state]

  return (
    <div
      className={cn(
        'border-t border-t-inset-hair px-inset py-snug',
        resolved ? 'bg-inset px-inset py-tight' : accent.card,
        walkFocus && 'bg-verdict-block-tint/12 ring-1 ring-verdict-block-tint/40',
      )}
    >
      <div className="flex items-center gap-gap">
        <SeverityIcon aria-hidden className={accent.icon} />
        <Text variant="tag" className="text-muted-foreground">
          {FINDING_SEVERITY[severity].word}
        </Text>
        <Text variant="meta" className="text-muted-foreground" as="span">
          :{line}
        </Text>
        <Badge shape="pill" variant={report.tone}>
          <report.Icon aria-hidden />
          {report.label}
        </Badge>
        <span className="grow" />
        <Text variant="meta" className="text-foreground-faint">
          {by}
        </Text>
        <Button variant={action.tone} size="sm" title={action.title} onClick={onAdvanceState}>
          <action.Icon aria-hidden />
          {action.label}
        </Button>
      </div>
      {resolved ? (
        <Text variant="row" className="text-muted-foreground">
          fixed · {findingBodyStub(body)}
        </Text>
      ) : (
        <Text variant="prose" className="mt-snug text-foreground-bright" as="p">
          {body}
        </Text>
      )}
    </div>
  )
}
