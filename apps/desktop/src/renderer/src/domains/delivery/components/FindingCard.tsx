import { cn } from '@/lib/utils'
import {
  AccentCard,
  AccentCardHeader,
  type AccentCardTone,
  Badge,
  Button,
  Text,
} from '@/shared/components/ui'
import { findingBodyStub } from './diffModel'
import {
  FINDING_SEVERITY,
  FINDING_STATE_ACTION,
  FINDING_STATE_REPORT,
  type FindingSeverity,
  type FindingState,
} from './findingState'

// The card's severity accent — the glyph ink plus the `AccentCard` tone the frame spends.
// Switched (not read off `FINDING_SEVERITY.tone`) so the literal class survives Tailwind's
// scan, and so the frame tone stays this card's own rendering detail — distinct from the tone
// it hands a Badge or Button, which report the finding's STATE, not its severity.
function severityAccent(severity: FindingSeverity): { icon: string; tone: AccentCardTone } {
  switch (severity) {
    case 'blocking':
      return { icon: 'text-verdict-block', tone: 'block' }
    case 'advisory':
      return { icon: 'text-verdict-changes', tone: 'changes' }
  }
}

/**
 * Molecule: a verdict-tinted `AccentCard` wedged under a diff hunk, reporting one review
 * finding — the same rail + eyebrow frame the Delivery panel's terminal card wears.
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
    <AccentCard
      tone={resolved ? 'approve' : accent.tone}
      className={cn(
        resolved && 'py-tight opacity-70',
        walkFocus && 'bg-verdict-block-tint/12 ring-verdict-block-tint/40',
      )}
    >
      <AccentCardHeader
        icon={<SeverityIcon aria-hidden className={accent.icon} />}
        eyebrow={FINDING_SEVERITY[severity].word}
        eyebrowClassName="text-muted-foreground"
        trailing={
          <>
            <Text variant="meta" className="text-foreground-faint">
              {by}
            </Text>
            <Button variant={action.tone} size="sm" title={action.title} onClick={onAdvanceState}>
              <action.Icon aria-hidden />
              {action.label}
            </Button>
          </>
        }
      >
        <Text variant="meta" className="text-muted-foreground" as="span">
          :{line}
        </Text>
        <Badge shape="pill" variant={report.tone}>
          <report.Icon aria-hidden />
          {report.label}
        </Badge>
      </AccentCardHeader>
      {resolved ? (
        <Text variant="row" className="text-muted-foreground">
          fixed · {findingBodyStub(body)}
        </Text>
      ) : (
        <Text variant="prose" className="text-foreground-bright" as="p">
          {body}
        </Text>
      )}
    </AccentCard>
  )
}
